import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/i18n/t", () => ({ T: ({ k }: { k: string }) => <span>{k}</span> }));
vi.mock("@/components/auth-message", () => ({ AuthMessage: () => null }));
vi.mock("@/components/legal-consent-notice", () => ({ LegalConsentNotice: () => null }));
vi.mock("@/app/(auth)/actions", () => ({ login: vi.fn(), signup: vi.fn(), demoLogin: vi.fn(), logout: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: true }));
import LoginPage from "@/app/(auth)/login/page";
import SignupPage from "@/app/(auth)/signup/page";

describe("WCAG 1.3.5 identify input purpose", () => {
  it("login form declares email and current-password autocomplete tokens", async () => {
    const html = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/<input[^>]*name="email"[^>]*autoComplete="email"|<input[^>]*autoComplete="email"[^>]*name="email"|autoComplete="email"/i);
    expect(html).toMatch(/autoComplete="current-password"/i);
  });

  it("signup form declares email and new-password autocomplete tokens", async () => {
    const html = renderToStaticMarkup(await SignupPage({ searchParams: Promise.resolve({}) }));
    expect(html).toMatch(/autoComplete="email"/i);
    expect(html).toMatch(/autoComplete="new-password"/i);
  });
});

describe("WCAG 4.1.3 status messages", () => {
  // Static guard: any red error paragraph/span that renders a dynamic error
  // value must be a live region, otherwise screen readers never hear it.
  const dynamicError = /<(p|span)\s+([^>]*?)className="[^"]*text-red-(?:600|700)[^"]*"[^>]*>\s*\{(?:error|copyError|nameError|passwordError|[A-Za-z.]*errors?\.[A-Za-z_.]+\.message|[A-Za-z]*[eE]rror)\}/g;

  it("every dynamic error message in components/ has role=alert", () => {
    const offenders: string[] = [];
    for (const file of globSync("components/**/*.tsx")) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(dynamicError)) {
        if (!/role="alert"/.test(match[0])) offenders.push(`${file}: ${match[0].slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
