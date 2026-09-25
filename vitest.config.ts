import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["__tests__/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      include: ["lib/**", "app/api/**"],
      exclude: ["**/*.test.ts", "**/__tests__/**"],
      // Plancher juste sous la couverture actuelle (70 / 60,6 / 73,5 / 70,6 %) :
      // empêche la régression, à remonter au fil des ajouts de tests.
      thresholds: {
        statements: 68,
        branches: 58,
        functions: 71,
        lines: 68,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
