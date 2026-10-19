import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/i18n/t", () => ({ T: ({ k }: { k: string }) => <span>{k}</span> }));
vi.mock("@/components/auth-message", () => ({ AuthMessage: () => null }));
vi.mock("@/components/legal-consent-notice", () => ({ LegalConsentNotice: () => null }));
vi.mock("@/app/(auth)/actions", () => ({ login: vi.fn(), signup: vi.fn(), demoLogin: vi.fn(), logout: vi.fn() }));
vi.mock("@/lib/supabase/config", () => ({ hasSupabaseConfig: true }));
import LoginPage from "@/app/(auth)/login/page";
import SignupPage from "@/app/(auth)/signup/page";
import { DemoBanner } from "@/components/layout/demo-banner";

afterEach(() => vi.unstubAllEnvs());
for (const [name, Page] of [["login", LoginPage], ["signup", SignupPage]] as const) {
  describe(`demo button on ${name}`, () => {
    it("renders only when both server variables exist, never their values", async () => {
      vi.stubEnv("DEMO_USER_EMAIL", "private-identifier");
      vi.stubEnv("DEMO_USER_PASSWORD", "private-password");
      const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
      expect(html).toContain("auth.demo.view");
      expect(html).not.toContain("private-identifier");
      expect(html).not.toContain("private-password");
    });
    it.each(["DEMO_USER_EMAIL", "DEMO_USER_PASSWORD"])("hides without %s", async (key) => {
      vi.stubEnv("DEMO_USER_EMAIL", "fixture");
      vi.stubEnv("DEMO_USER_PASSWORD", "fixture");
      vi.stubEnv(key, "");
      expect(renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }))).not.toContain("auth.demo.view");
    });
  });
}
it("shows a non-overlay status and logout action only for a demo", () => {
  expect(renderToStaticMarkup(<DemoBanner isDemo={false} />)).toBe("");
  const html = renderToStaticMarkup(<DemoBanner isDemo />);
  expect(html).toContain('role="status"');
  expect(html).toContain("common.demo.banner");
  expect(html).toContain("common.demo.exit");
  expect(html).not.toContain("fixed");
});
