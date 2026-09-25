#!/usr/bin/env node
// Watches the upstream blockers that keep two major upgrades on hold, and
// opens a GitHub issue as soon as one of them is lifted.
//
//   node scripts/check-upstream-support.mjs            # dry run: just report
//   node scripts/check-upstream-support.mjs --create   # also open issues (needs GH_TOKEN)
//
// Run weekly by .github/workflows/upstream-watch.yml. Needs `semver`.
import { execFileSync } from "node:child_process";

import semver from "semver";

const CHECKS = [
  {
    key: "typescript-7",
    package: "typescript-eslint",
    peer: "typescript",
    probe: "7.0.0",
    title: "TypeScript 7 est désormais supporté par typescript-eslint",
    body: [
      "La dernière version de `typescript-eslint` accepte maintenant TypeScript 7 dans ses `peerDependencies`.",
      "",
      "À faire :",
      "- passer `typescript` en `^7` dans `package.json` et **supprimer l'alias `typescript-7`** ;",
      "- remplacer le script `typecheck` par `tsc --noEmit` ;",
      "- retirer la règle `typescript` (majeures ignorées) de `.github/dependabot.yml` ;",
      "- vérifier `npm run lint`, `npm run typecheck`, `npm run build`, et que Next.js fonctionne avec TypeScript 7.",
      "",
      "_Ticket ouvert automatiquement par `scripts/check-upstream-support.mjs`._",
    ].join("\n"),
  },
  {
    key: "eslint-10",
    package: "eslint-plugin-react",
    peer: "eslint",
    probe: "10.0.0",
    title: "ESLint 10 est désormais supporté par eslint-plugin-react",
    body: [
      "La dernière version d'`eslint-plugin-react` accepte maintenant ESLint 10 dans ses `peerDependencies` (elle utilisait `context.getFilename()`, supprimé dans ESLint 10).",
      "",
      "À faire :",
      "- vérifier que `eslint-config-next` embarque cette version du plugin (ou forcer via `overrides`) ;",
      "- passer `eslint` en `^10`, puis `npm run lint` ;",
      "- retirer la règle `eslint` (majeures ignorées) de `.github/dependabot.yml`.",
      "",
      "_Ticket ouvert automatiquement par `scripts/check-upstream-support.mjs`._",
    ].join("\n"),
  },
];

const create = process.argv.includes("--create");
let failed = false;

for (const check of CHECKS) {
  const res = await fetch(`https://registry.npmjs.org/${check.package}/latest`);
  if (!res.ok) {
    console.error(`::warning::npm registry returned ${res.status} for ${check.package}`);
    failed = true;
    continue;
  }
  const meta = await res.json();
  const range = meta.peerDependencies?.[check.peer];
  const supported = Boolean(range) && semver.satisfies(check.probe, range);
  console.log(
    `${check.package}@${meta.version}: peer ${check.peer} "${range}" → ${check.probe} ${supported ? "SUPPORTED" : "not supported yet"}`,
  );

  if (!supported || !create) continue;

  const existing = JSON.parse(
    execFileSync("gh", ["issue", "list", "--state", "open", "--search", `"${check.title}" in:title`, "--json", "number"], {
      encoding: "utf8",
    }),
  );
  if (existing.length > 0) {
    console.log(`Issue already open (#${existing[0].number}), nothing to do.`);
    continue;
  }
  const url = execFileSync("gh", ["issue", "create", "--title", check.title, "--body", check.body], { encoding: "utf8" });
  console.log(`Opened ${url.trim()}`);
}

if (failed) process.exit(1);
