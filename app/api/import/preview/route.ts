import { NextResponse } from "next/server";
import { z } from "zod";

import { buildDefaultMatcher, buildHistoryMatcher, buildRuleMatcher, buildRuleShareMatcher, detectTransfer } from "@/lib/import/apply-rules";
import { buildFileHashes, findExistingHashes, findTransferMirrorMatches } from "@/lib/import/deduplicate";
import { detectFormat } from "@/lib/import/detect-format";
import { matchMerchant } from "@/lib/import/merchants";
import { normalizeLabel, type LabelSource } from "@/lib/import/normalize-label";
import { resolveSuggestion, type SpaceCategory } from "@/lib/import/resolve-suggestion";
import { isTransferSourceType, parseN26Csv } from "@/lib/import/parse-n26";
import { logApiError } from "@/lib/api/log-error";
import { withSpace } from "@/lib/spaces/with-space";

/** Upload guards (issue 163): bank exports are far below these limits. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

const ALLOWED_MIME_TYPES: Record<"csv" | "xls" | "xlsx", string[]> = {
  csv: ["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream", ""],
  xls: ["application/vnd.ms-excel", "application/octet-stream", ""],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream", ""],
};

export async function POST(request: Request) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, spaceId } = auth;
  const isPersonal = auth.space.kind === "personal";

  // Refuse early on the declared size, before reading the body.
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMPORT_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "Fichier trop volumineux (2 Mo maximum)" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
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

  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: "Fichier trop volumineux (2 Mo maximum)" }, { status: 413 });
  }

  const fileName = file.name.toLowerCase();
  const extension = fileName.endsWith(".csv") ? "csv" : fileName.endsWith(".xlsx") ? "xlsx" : fileName.endsWith(".xls") ? "xls" : null;
  if (!extension) {
    return NextResponse.json({ error: "Format de fichier non supporté (.csv, .xls, .xlsx uniquement)" }, { status: 400 });
  }
  if (!ALLOWED_MIME_TYPES[extension].includes(file.type.toLowerCase())) {
    return NextResponse.json({ error: "Type de fichier non supporté" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();

  // Parse the file based on extension + content
  let parsed;
  let source: LabelSource;

  if (fileName.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    const firstLine = text.split(/\r?\n/)[0] ?? "";
    const headers = firstLine.split(",").map((h) => h.replace(/^"|"$/g, "").trim());
    const format = detectFormat(headers);

    if (format === "n26") {
      parsed = parseN26Csv(text);
      source = "n26";
    } else {
      return NextResponse.json({ error: "Format CSV non reconnu. Formats supportés : N26." }, { status: 400 });
    }
  } else if (fileName.endsWith(".xls") || fileName.endsWith(".xlsx")) {
    try {
      // Dynamic import: SheetJS stays out of the CSV path (issue 163).
      const XLSX = await import("xlsx");
      const { parseBnpXls } = await import("@/lib/import/parse-bnp");
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
        source = "bnp";
      } else {
        return NextResponse.json({ error: "Format XLS non reconnu. Formats supportés : BNP." }, { status: 400 });
      }
    } catch (err) {
      logApiError("[import/preview] XLS parse error", err);
      return NextResponse.json({ error: "Impossible de lire le fichier XLS" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Format de fichier non supporté (.csv, .xls, .xlsx uniquement)" }, { status: 400 });
  }

  if (parsed.length > MAX_IMPORT_ROWS) {
    return NextResponse.json(
      { error: `Trop de lignes (${MAX_IMPORT_ROWS} maximum par import)` },
      { status: 422 },
    );
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
      .select("id, name, kind, translation_key")
      .eq("space_id", spaceId)
      .is("deleted_at", null),
    isPersonal ? buildRuleShareMatcher(supabase, spaceId) : Promise.resolve(null),
  ]);

  const categories = (categoriesData.data ?? []) as (SpaceCategory & { translation_key: string | null })[];
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

    const is_transfer_candidate = detectTransfer(tx.description) || isTransferSourceType(tx.source_type);
    const kind: "expense" | "income" = tx.amount_cents < 0 ? "expense" : "income";
    // issue 130: rules > history > merchants database > default keywords.
    // Transfers and duplicates get no suggestion ("À catégoriser").
    const suggestion =
      isDuplicate || is_transfer_candidate
        ? null
        : resolveSuggestion(
            tx.description,
            kind,
            { rule: ruleMatcher, history: historyMatcher, default: defaultMatcher },
            categories,
          );
    const suggestedCategoryId = suggestion?.category_id ?? null;

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

    // `description` stays the raw bank label and the hash above is built on it.
    // A known merchant name beats the generic cleaning (issue 130).
    const normalized = normalizeLabel(tx.description, { source });
    const merchant = suggestion?.merchant ?? (is_transfer_candidate ? null : matchMerchant(tx.description));
    const clean = merchant?.name ?? normalized.clean;
    const raw = normalized.raw;

    return {
      hash: tx.hash,
      date: tx.date,
      description: tx.description,
      clean_description: clean,
      raw_description: raw,
      amount_cents: tx.amount_cents,
      kind,
      suggested_category_id: suggestedCategoryId,
      suggestion_source: suggestedCategoryId ? (suggestion?.source ?? null) : null,
      source_type: tx.source_type ?? null,
      source_category: tx.source_category ?? null,
      is_transfer_candidate,
      is_duplicate: isDuplicate,
      duplicate_reason: isMirror ? ("transfer_mirror" as const) : isDuplicate ? ("already_imported" as const) : null,
      suggested_share: suggestedShare,
    };
  });

  return NextResponse.json({ preview });
}
