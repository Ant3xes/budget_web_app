import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { en } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";

const lookup = (dict: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((node, segment) => {
    if (node && typeof node === "object" && segment in node) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dict);

const leafKeys = (node: unknown, prefix = ""): string[] =>
  node && typeof node === "object"
    ? Object.entries(node).flatMap(([key, value]) => leafKeys(value, prefix ? `${prefix}.${key}` : key))
    : [prefix];

// Files that call t("...") / <T k="..."> / *Key="..." with keys from the spaces feature.
const FILES = [
  "components/layout/space-switcher.tsx",
  "components/spaces/create-space-form.tsx",
  "components/spaces/space-action-button.tsx",
  "components/spaces/revoke-invitation-button.tsx",
  "components/invitations/invite-form.tsx",
  "components/invitations/invitation-status-label.tsx",
  "app/(app)/invitations/page.tsx",
  "app/invite/[token]/page.tsx",
  // Phase 2: shared expenses and settlements.
  "components/spaces/default-share-form.tsx",
  "components/transactions/share-transaction-modal.tsx",
  "components/transactions/transaction-list.tsx",
  "app/(app)/balance/page.tsx",
  "components/balance/balance-card.tsx",
  "components/balance/balance-delete-button.tsx",
  "components/balance/settlement-list.tsx",
  "components/balance/settlement-modal.tsx",
  "components/balance/shared-expense-list.tsx",
  // Phase 3: shared spaces' dashboard and analytics.
  "app/(app)/analytics/page.tsx",
  // Phase 4: import rules that share.
  "components/settings/import-rules-modal.tsx",
  "components/settings/import-rules-list.tsx",
  "components/settings/apply-rule-share-modal.tsx",
  "components/import/import-modal.tsx",
];

const usedKeys = (file: string) => {
  const source = readFileSync(join(process.cwd(), file), "utf8");
  const keys = new Set<string>();
  // Any quoted dotted key passed to t(...), <T k=...> or a *Key prop — not only
  // nav./invitations. ones, so a mistyped prefix (e.g. "spaces.x") is caught too.
  for (const match of source.matchAll(/(?:\bt\(\s*|\bk=\{?|Key=\{?)["'`]([A-Za-z]+(?:\.[A-Za-z]+)+)["'`]/g)) {
    keys.add(match[1]);
  }
  return [...keys];
};

describe("i18n keys of the spaces feature", () => {
  it.each(FILES)("%s only uses keys that exist in fr and en", (file) => {
    for (const key of usedKeys(file)) {
      expect(lookup(fr, key), `fr: ${key}`).toBeTypeOf("string");
      expect(lookup(en, key), `en: ${key}`).toBeTypeOf("string");
    }
  });

  it.each(["dashboard.sharedNote", "dashboard.sharedNoteFiltered", "analytics.sharedNote"])(
    "%s exists in fr and en",
    (key) => {
      expect(lookup(fr, key), `fr: ${key}`).toBeTypeOf("string");
      expect(lookup(en, key), `en: ${key}`).toBeTypeOf("string");
    },
  );

  it("finds keys in the switcher (guards the extractor itself)", () => {
    expect(usedKeys("components/layout/space-switcher.tsx")).toContain("nav.spaces.personal");
  });

  it.each(["nav", "invitations", "sharedExpenses", "balance", "dashboard", "analytics", "importRules", "transactions"] as const)("%s has the same keys in fr and en", (section) => {
    expect(leafKeys(fr[section]).sort()).toEqual(leafKeys(en[section]).sort());
  });
});
