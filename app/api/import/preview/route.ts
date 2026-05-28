import * as XLSX from "xlsx";

import { NextResponse } from "next/server";

import { buildRuleMatcher } from "@/lib/import/apply-rules";
import { buildHash, findExistingHashes } from "@/lib/import/deduplicate";
import { detectFormat } from "@/lib/import/detect-format";
import { parseBnpXls } from "@/lib/import/parse-bnp";
import { parseN26Csv } from "@/lib/import/parse-n26";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

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

  // Build hashes and find duplicates
  const hashed = parsed.map((tx) => ({ ...tx, hash: buildHash(tx) }));
  const allHashes = hashed.map((tx) => tx.hash);
  const existingHashes = await findExistingHashes(supabase, user.id, allHashes);

  // Build rule matcher for auto-categorization
  const matcher = await buildRuleMatcher(supabase, user.id);

  // Determine kind from amount sign and apply auto-categorization
  const preview = hashed.map((tx) => {
    const kind: "expense" | "income" = tx.amount_cents < 0 ? "expense" : "income";
    const suggestedCategoryId = matcher(tx.description, kind);
    const isDuplicate = existingHashes.has(tx.hash);

    return {
      hash: tx.hash,
      date: tx.date,
      description: tx.description,
      amount_cents: tx.amount_cents,
      kind,
      suggested_category_id: suggestedCategoryId,
      is_duplicate: isDuplicate,
    };
  });

  return NextResponse.json({ preview });
}
