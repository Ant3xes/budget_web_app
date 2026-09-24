import * as XLSX from "xlsx";

import { NextResponse } from "next/server";
import { z } from "zod";

import { buildDefaultMatcher, buildHistoryMatcher, buildRuleMatcher, buildRuleShareMatcher, detectTransfer } from "@/lib/import/apply-rules";
import { buildFileHashes, findExistingHashes, findTransferMirrorMatches } from "@/lib/import/deduplicate";
import { detectFormat } from "@/lib/import/detect-format";
import { parseBnpXls } from "@/lib/import/parse-bnp";
import { parseN26Csv } from "@/lib/import/parse-n26";
import { withSpace } from "@/lib/spaces/with-space";

export async function POST(request: Request) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, spaceId } = auth;
  const isPersonal = auth.space.kind === "personal";

  const formData = await request.formData();
  const file = formData.get("file");

  // Target account: duplicates are looked up in this account only (the same
  // line on another bank account is a different transaction) and the transfer
  // lines already mirrored into it are recognised.
  const accountField = formData.get("account_id");
  const accountId = typeof accountField === "string" && accountField ? accountField : null;
  if (accountId && !z.guid().safeParse(accountId).success) {
    return NextResponse.json({ error: "Compte invalide" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const fileName = file.name.toLowerCase();

  // Parse the file based on extension + content
  let parsed;

  if (fileName.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    const firstLine = text.split(/\r?\n/)[0] ?? "";
    const headers = firstLine.split(",").map((h) => h.replace(/^"|"$/g, "").trim());
    const format = detectFormat(headers);

    if (format === "n26") {
      parsed = parseN26Csv(text);
    } else {
      return NextResponse.json({ error: "Format CSV non reconnu. Formats supportés : N26." }, { status: 400 });
    }
  } else if (fileName.endsWith(".xls") || fileName.endsWith(".xlsx")) {
    try {
      // Detect BNP by looking at row 1 headers (index 1 in the sheet)
      const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
      if (!sheet) {
        return NextResponse.json({ error: "Fichier XLS vide ou invalide" }, { status: 400 });
      }
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false }) as string[][];
      // Find header row dynamically (BNP may have an empty row between account info and headers)
      const headerRow =
        rows.find((row) => row.some((cell) => String(cell).trim().toLowerCase().includes("date operation"))) ?? [];
      const format = detectFormat(headerRow.map(String));

      if (format === "bnp") {
        parsed = parseBnpXls(buffer);
      } else {
        return NextResponse.json({ error: "Format XLS non reconnu. Formats supportés : BNP." }, { status: 400 });
      }
    } catch (err) {
      console.error("[import/preview] XLS parse error:", err);
      return NextResponse.json({ error: "Impossible de lire le fichier XLS" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Format de fichier non supporté (.csv, .xls, .xlsx uniquement)" }, { status: 400 });
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "Aucune transaction trouvée dans le fichier" }, { status: 400 });
  }

  // Build hashes and find duplicates. Identical lines of the file get distinct
  // hashes (occurrence number), so two real purchases are never merged.
  const fileHashes = buildFileHashes(parsed);
  const hashed = parsed.map((tx, index) => ({ ...tx, hash: fileHashes[index]! }));
  const existingHashes = await findExistingHashes(supabase, spaceId, fileHashes, accountId);

  // Lines that are the other side of a transfer already imported (its mirror
  // sits in this account): importing them would count the money twice.
  const mirrorCandidates = hashed
    .map((tx, index) => ({ tx, index }))
    .filter(({ tx }) => !existingHashes.has(tx.hash));
  const mirrorMatches = accountId
    ? await findTransferMirrorMatches(
        supabase,
        spaceId,
        accountId,
        mirrorCandidates.map(({ tx }) => ({ date: tx.date, amount_cents: tx.amount_cents })),
      )
    : new Set<number>();
  const mirrorIndexes = new Set([...mirrorMatches].map((i) => mirrorCandidates[i]!.index));

  // Build matchers for auto-categorization (rules > history > built-in defaults)
  const [ruleMatcher, historyMatcher, categoriesData, shareMatcher] = await Promise.all([
    buildRuleMatcher(supabase, spaceId),
    buildHistoryMatcher(supabase, spaceId),
    supabase
      .from("categories")
      .select("id, name, kind")
      .eq("space_id", spaceId)
      .is("deleted_at", null),
    isPersonal ? buildRuleShareMatcher(supabase, spaceId) : Promise.resolve(null),
  ]);

  const categories = (categoriesData.data ?? []) as { id: string; name: string; kind: "expense" | "income" }[];
  const defaultMatcher = buildDefaultMatcher(categories);

  // Sharing suggestions (personal space only): resolve the shared spaces the
  // rules point to, in one query. A stale target (space left) yields no suggestion.
  const sharedSpaceIds = new Set(auth.spaces.filter((space) => space.kind === "shared").map((space) => space.id));
  const targets = new Map<string, { name: string; default_share_percent: number }>();
  if (shareMatcher) {
    const neededIds = new Set<string>();
    for (const tx of hashed) {
      const share = shareMatcher(tx.description, tx.amount_cents < 0 ? "expense" : "income");
      if (share && sharedSpaceIds.has(share.space_id)) neededIds.add(share.space_id);
    }
    if (neededIds.size > 0) {
      const { data } = await supabase
        .from("spaces")
        .select("id, name, default_share_percent")
        .in("id", [...neededIds]);
      for (const row of (data ?? []) as { id: string; name: string; default_share_percent: number }[]) {
        targets.set(row.id, { name: row.name, default_share_percent: Number(row.default_share_percent) });
      }
    }
  }

  // Determine kind from amount sign; flag transfer candidates separately
  const preview = hashed.map((tx, index) => {
    const isMirror = mirrorIndexes.has(index);
    const isDuplicate = existingHashes.has(tx.hash) || isMirror;

    const is_transfer_candidate = detectTransfer(tx.description);
    const kind: "expense" | "income" = tx.amount_cents < 0 ? "expense" : "income";
    const suggestedCategoryId = isDuplicate || is_transfer_candidate
      ? null
      : (ruleMatcher(tx.description, kind) ??
        historyMatcher(tx.description, kind) ??
        defaultMatcher(tx.description, kind) ??
        null);

    let suggestedShare: {
      space_id: string;
      space_name: string;
      category_id: string | null;
      payer_share_percent: number;
    } | null = null;
    if (shareMatcher && kind === "expense" && !isDuplicate && !is_transfer_candidate) {
      const share = shareMatcher(tx.description, kind);
      const target = share ? targets.get(share.space_id) : undefined;
      if (share && target && sharedSpaceIds.has(share.space_id)) {
        suggestedShare = {
          space_id: share.space_id,
          space_name: target.name,
          category_id: share.category_id,
          payer_share_percent: share.payer_share_percent ?? target.default_share_percent,
        };
      }
    }

    return {
      hash: tx.hash,
      date: tx.date,
      description: tx.description,
      amount_cents: tx.amount_cents,
      kind,
      suggested_category_id: suggestedCategoryId,
      is_transfer_candidate,
      is_duplicate: isDuplicate,
      duplicate_reason: isMirror ? ("transfer_mirror" as const) : isDuplicate ? ("already_imported" as const) : null,
      suggested_share: suggestedShare,
    };
  });

  return NextResponse.json({ preview });
}
