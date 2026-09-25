import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  // Échoue vite en CI si l'app est cassée, au lieu de 30 s x tests x retries.
  maxFailures: process.env.CI ? 5 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Navigation mobile (bottom nav, sheets) : uniquement les parcours qui en
    // dépendent, pour ne pas doubler la durée de la CI.
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /(a11y|mobile)\.spec\.ts/,
    },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
      },
});
