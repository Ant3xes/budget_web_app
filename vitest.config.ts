import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    include: ["__tests__/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      include: ["lib/**", "app/api/**"],
      exclude: ["**/*.test.ts", "**/__tests__/**"],
      // Plancher juste sous la couverture actuelle (80,8 / 76,3 / 83,2 / 81,4 %) :
      // empêche la régression, à remonter au fil des ajouts de tests. Les
      // composants et pages ne sont pas dans le périmètre (beaucoup de
      // composants hors livraison retours 2 n'ont pas encore de tests).
      thresholds: {
        statements: 78,
        branches: 73,
        functions: 80,
        lines: 78,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
