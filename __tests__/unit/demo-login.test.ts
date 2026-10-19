import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), signOut: vi.fn(), rpc: vi.fn(), client: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "demo-test" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(url); } }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));
import { demoLogin } from "@/app/(auth)/actions";

describe("demoLogin (issue 166)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DEMO_USER_EMAIL", "fixture@example.invalid");
    vi.stubEnv("DEMO_USER_PASSWORD", "fixture-password-not-a-secret");
    mocks.client.mockResolvedValue({ auth: mocks, rpc: mocks.rpc });
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["DEMO_USER_EMAIL", "DEMO_USER_PASSWORD"])("does not create a session without %s", async (key) => {
    vi.stubEnv(key, "");
    await expect(demoLogin()).rejects.toThrow("/login?message=demoUnavailable");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("signs out a misconfigured real account immediately", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(demoLogin()).rejects.toThrow("/login?message=demoMisconfigured");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("fails closed when demo verification fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private error" } });
    await expect(demoLogin()).rejects.toThrow("/login?message=demoMisconfigured");
    expect(mocks.signOut).toHaveBeenCalled();
  });
  it("redirects a verified demo to the dashboard", async () => {
    await expect(demoLogin()).rejects.toThrow(/^\/dashboard$/);
    expect(mocks.rpc).toHaveBeenCalledWith("is_demo_user");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("never copies an auth error containing credentials into the URL", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: process.env.DEMO_USER_PASSWORD } });
    await expect(demoLogin()).rejects.toThrow(/^\/login\?message=demoUnavailable$/);
  });
  it("rate-limits repeated failures separately from ordinary login", async () => {
    vi.resetModules();
    const actions = await import("@/app/(auth)/actions");
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "private" } });
    for (let i = 0; i < 5; i++) await expect(actions.demoLogin()).rejects.toThrow("demoUnavailable");
    await expect(actions.demoLogin()).rejects.toThrow("rateLimited");
    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(5);
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    const form = new FormData();
    form.set("email", "fixture@example.invalid");
    form.set("password", "fixture-password-not-a-secret");
    await expect(actions.login(form)).rejects.toThrow(/^\/dashboard$/);
  });
});
