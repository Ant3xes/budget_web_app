#!/usr/bin/env node
// Bundle-size budget for the client JavaScript emitted by `next build`.
//
//   node scripts/check-bundle-size.mjs            # compare against bundle-budget.json
//   node scripts/check-bundle-size.mjs --update   # rewrite the budget from the current build
//
// Sizes are gzip sizes of every .js file in .next/static/chunks (what the
// browser downloads, ignoring HTTP-level compression differences). The budget
// is the measured size plus a margin, so normal work doesn't trip it but a
// heavy new dependency does.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const CHUNKS_DIR = ".next/static/chunks";
const BUDGET_FILE = "bundle-budget.json";
const MARGIN = 0.1; // 10 % headroom when (re)writing the budget

function listJs(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listJs(path);
    return name.endsWith(".js") ? [path] : [];
  });
}

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;

let files;
try {
  files = listJs(CHUNKS_DIR);
} catch {
  console.error(`No build output in ${CHUNKS_DIR}: run \`npm run build\` first.`);
  process.exit(2);
}

const sizes = files
  .map((path) => ({ path, gzip: gzipSync(readFileSync(path)).length }))
  .sort((a, b) => b.gzip - a.gzip);
const totalGzipKb = kb(sizes.reduce((sum, f) => sum + f.gzip, 0));
const maxChunkGzipKb = kb(sizes[0].gzip);

console.log(`Client JS: ${files.length} chunks, ${totalGzipKb} kB gzip total, largest ${maxChunkGzipKb} kB`);
for (const f of sizes.slice(0, 5)) console.log(`  ${kb(f.gzip).toString().padStart(7)} kB  ${f.path}`);

if (process.argv.includes("--update")) {
  const budget = {
    totalGzipKb: Math.ceil(totalGzipKb * (1 + MARGIN)),
    maxChunkGzipKb: Math.ceil(maxChunkGzipKb * (1 + MARGIN)),
  };
  writeFileSync(BUDGET_FILE, JSON.stringify(budget, null, 2) + "\n");
  console.log(`Wrote ${BUDGET_FILE}:`, budget);
  process.exit(0);
}

const budget = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
const checks = [
  ["total gzip", totalGzipKb, budget.totalGzipKb],
  ["largest chunk gzip", maxChunkGzipKb, budget.maxChunkGzipKb],
];

const rows = checks.map(([name, actual, limit]) => ({ name, actual, limit, ok: actual <= limit }));
const table = rows
  .map((r) => `| ${r.name} | ${r.actual} kB | ${r.limit} kB | ${r.ok ? "✅" : "❌"} |`)
  .join("\n");
const summary = `### Budget de bundle\n\n| Mesure | Actuel | Budget | |\n|---|---|---|---|\n${table}\n`;
console.log("\n" + summary);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: "a" });

if (rows.some((r) => !r.ok)) {
  console.error(
    "Bundle budget exceeded. If the increase is intentional, run `node scripts/check-bundle-size.mjs --update` and commit bundle-budget.json.",
  );
  process.exit(1);
}
