import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "@/components/locale-provider";
import { ImportButton } from "@/components/import/import-button";
import { en } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";

const render = (hasAccount: boolean) =>
  renderToStaticMarkup(
    createElement(
      LocaleProvider,
      null,
      createElement(ImportButton, { label: "Importer", hasAccount, onImport: () => {}, onCreateAccount: () => {} }),
    ),
  );

describe("ImportButton (issue 102)", () => {
  it("sans compte : bouton désactivé, message relié par aria-describedby et bouton de création", () => {
    const html = render(false);
    const button = html.match(/<button[^>]*>Importer<\/button>/)?.[0] ?? "";
    expect(button).toMatch(/ disabled=""/);
    const describedBy = button.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeTruthy();
    expect(html).toContain(`id="${describedBy}"`);
    expect(html).toContain("Crée d&#x27;abord un compte");
    expect(html).toMatch(/<button[^>]*>Créer un compte<\/button>/);
  });

  it("avec compte : bouton actif, aucun message", () => {
    const html = render(true);
    expect(html).toMatch(/<button[^>]*>Importer<\/button>/);
    expect(html).not.toMatch(/ disabled=""/);
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("Crée d");
  });

  it("clé i18n présente en fr et en", () => {
    expect(fr.accounts.list.importNeedsAccount).toBeTruthy();
    expect(en.accounts.list.importNeedsAccount).toBeTruthy();
  });
});
