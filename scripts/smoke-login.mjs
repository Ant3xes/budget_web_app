#!/usr/bin/env node
// Signed-in smoke test of a deployed instance (used after each production
// deploy by .github/workflows/smoke.yml).
//
//   SMOKE_EMAIL=... SMOKE_PASSWORD=... node scripts/smoke-login.mjs https://my-app.vercel.app
//
// Logs in with a dedicated, read-only account and checks that:
//   1. authentication works against the real Supabase project (this is what
//      breaks when NEXT_PUBLIC_SUPABASE_* are missing or wrong in Vercel),
//   2. the dashboard renders for a signed-in user,
//   3. an authenticated API read goes through Supabase + RLS and succeeds.
// It never writes data and never prints the credentials.
import { chromium } from "@playwright/test";

const baseUrl = (process.argv[2] ?? "").replace(/\/$/, "");
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

if (!baseUrl || !email || !password) {
  console.error("usage: SMOKE_EMAIL=... SMOKE_PASSWORD=... node scripts/smoke-login.mjs <base-url>");
  process.exit(2);
}

const browser = await chromium.launch();
const context = await browser.newContext({ baseURL: baseUrl });
const page = await context.newPage();
page.setDefaultTimeout(20_000);

async function step(name, fn) {
  process.stdout.write(`- ${name}... `);
  await fn();
  console.log("ok");
}

let failure = null;
try {
  await step("sign in through the login form", async () => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/mot de passe|password/i).fill(password);
    await page.getByRole("button", { name: /connexion|se connecter|login|sign in/i }).click();
    await page.waitForURL(/\/dashboard/);
  });

  await step("dashboard renders for the signed-in user", async () => {
    await page.getByRole("heading").first().waitFor();
    const text = (await page.locator("body").innerText()).toLowerCase();
    if (text.includes("application error") || text.includes("something went wrong")) {
      throw new Error("dashboard shows an error page");
    }
  });

  await step("authenticated API read (Supabase + RLS)", async () => {
    const res = await page.request.get("/api/accounts");
    if (res.status() !== 200) throw new Error(`/api/accounts returned ${res.status()}`);
    const body = await res.json();
    if (!Array.isArray(body.accounts)) throw new Error("/api/accounts payload has no accounts array");
  });
} catch (error) {
  failure = error;
  console.log("FAILED");
  // Screenshot for the CI artifact. The account is a dedicated test account.
  await page.screenshot({ path: "smoke-login-failure.png", fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

if (failure) {
  console.error(`::error::Signed-in smoke test failed: ${failure.message}`);
  process.exit(1);
}
console.log("Signed-in smoke test passed.");
