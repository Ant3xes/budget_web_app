import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Les builds CI/Vercel et les archives sans Git n'installent aucun hook.
if (!process.env.CI && !process.env.VERCEL && existsSync(".git")) {
  const result = spawnSync("lefthook", ["install"], { stdio: "inherit" });
  if (result.error || result.status !== 0) {
    console.warn("Hooks non installés : relancer npm run prepare dans un checkout local.");
  }
}
