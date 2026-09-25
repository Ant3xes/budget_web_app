#!/usr/bin/env node
// Lighthouse audit of the running app, including pages behind the login.
//
//   BASE_URL=http://localhost:3000 node scripts/lighthouse.mjs
//
// Uses Playwright's Chromium (already installed for the E2E tests) with a
// remote-debugging port: we log in with Playwright, then point Lighthouse at
// the same browser so it audits the pages as the signed-in user. Storage reset
// is disabled, otherwise Lighthouse would wipe the session cookies.
//
// Minimum scores per category live in lighthouse-budget.json. Reports (HTML +
// JSON) are written to lighthouse-results/ for the CI artifact.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chromium } from "@playwright/test";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.TEST_EMAIL || "test@budget.local";
const PASSWORD = process.env.TEST_PASSWORD || "Password1234!";
const PORT = 9222;
const OUT_DIR = "lighthouse-results";

const budget = JSON.parse(readFileSync("lighthouse-budget.json", "utf8"));
const categories = Object.keys(budget.minScores);

mkdirSync(OUT_DIR, { recursive: true });

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "lh-")), {
  headless: true,
  args: [`--remote-debugging-port=${PORT}`],
});
const page = context.pages()[0] ?? (await context.newPage());

const results = [];

async function audit(pageSpec) {
  const url = `${BASE_URL}${pageSpec.path}`;
  const run = await lighthouse(
    url,
    {
      port: PORT,
      output: ["html", "json"],
      logLevel: "error",
      onlyCategories: categories,
      disableStorageReset: true,
    },
    desktopConfig,
  );
  if (!run) throw new Error(`Lighthouse returned no result for ${url}`);

  const slug = pageSpec.path.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "home";
  writeFileSync(join(OUT_DIR, `${slug}.html`), run.report[0]);
  writeFileSync(join(OUT_DIR, `${slug}.json`), run.report[1]);

  const scores = Object.fromEntries(
    categories.map((c) => [c, Math.round((run.lhr.categories[c]?.score ?? 0) * 100)]),
  );
  // Surface which audits are dragging a category down, to make failures actionable.
  const failing = Object.values(run.lhr.audits)
    .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative" && a.scoreDisplayMode !== "notApplicable")
    .map((a) => `${a.id} (${Math.round(a.score * 100)})`);
  results.push({ path: pageSpec.path, scores, failing });
}

try {
  // Public page first, while signed out.
  for (const p of budget.pages.filter((p) => !p.auth)) await audit(p);

  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/mot de passe|password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /connexion|se connecter|login|sign in/i }).click();
  await page.waitForURL(/dashboard/);

  for (const p of budget.pages.filter((p) => p.auth)) await audit(p);
} finally {
  await context.close();
}

// ---- Report -------------------------------------------------------------
let failed = false;
const header = `| Page | ${categories.join(" | ")} |\n|---|${categories.map(() => "---").join("|")}|`;
const rows = results.map((r) => {
  const cells = categories.map((c) => {
    const ok = r.scores[c] >= budget.minScores[c];
    if (!ok) failed = true;
    return `${r.scores[c]} ${ok ? "✅" : `❌ (min ${budget.minScores[c]})`}`;
  });
  return `| \`${r.path}\` | ${cells.join(" | ")} |`;
});
const summary = `### Lighthouse (bureau)\n\n${header}\n${rows.join("\n")}\n`;
console.log(summary);
for (const r of results) console.log(`${r.path}: audits < 90 → ${r.failing.join(", ") || "none"}`);
if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: "a" });

if (failed) {
  console.error("Lighthouse scores below the minimums in lighthouse-budget.json.");
  process.exit(1);
}
