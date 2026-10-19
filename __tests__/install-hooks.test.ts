import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/install-hooks.mjs");

describe("installation des hooks", () => {
  it.each([{ CI: "true" }, { VERCEL: "1" }, {}])(
    "reste sans effet hors checkout ou dans un build hébergé (%j)",
    (environment) => {
      const directory = mkdtempSync(resolve(tmpdir(), "budget-hooks-"));
      try {
        if ("CI" in environment || "VERCEL" in environment) {
          mkdirSync(resolve(directory, ".git"));
        }
        const result = spawnSync(process.execPath, [script], {
          cwd: directory,
          env: { ...process.env, CI: "", VERCEL: "", ...environment, PATH: "" },
          encoding: "utf8",
        });
        expect(result.status).toBe(0);
        expect(result.stdout).toBe("");
        expect(result.stderr).toBe("");
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
