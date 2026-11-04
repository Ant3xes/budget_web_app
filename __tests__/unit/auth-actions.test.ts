import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signUp: vi.fn(), client: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "198.51.100.7" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(url);
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.client }));

import { login, signup } from "@/app/(auth)/actions";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.client.mockResolvedValue({ auth: { signInWithPassword: mocks.signInWithPassword, signUp: mocks.signUp } });
});

describe("login redirects carry sentinels, never auth-library text", () => {
  it("uses invalidCredentials for a wrong password", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials", code: "invalid_credentials" } });
    await expect(login(form({ email: "a@example.com", password: "wrong-password" }))).rejects.toThrow(
      /^\/login\?message=invalidCredentials$/,
    );
  });

  it("answers identically for an unknown account (no account enumeration)", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "User not found", code: "user_not_found" } });
    await expect(login(form({ email: "ghost@example.com", password: "whatever-1" }))).rejects.toThrow(
      /^\/login\?message=invalidCredentials$/,
    );
  });

  it("keeps the unconfirmed-email hint, as a sentinel", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "Email not confirmed", code: "email_not_confirmed" } });
    await expect(login(form({ email: "b@example.com", password: "whatever-1" }))).rejects.toThrow(
      /^\/login\?message=emailNotConfirmed$/,
    );
  });

  it("preserves a safe next target and drops an unsafe one", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "x" } });
    await expect(login(form({ email: "c@example.com", password: "whatever-1", next: "/invite/abc" }))).rejects.toThrow(
      "/login?message=invalidCredentials&next=%2Finvite%2Fabc",
    );
    await expect(login(form({ email: "d@example.com", password: "whatever-1", next: "//evil.example" }))).rejects.toThrow(
      /^\/login\?message=invalidCredentials$/,
    );
  });
});

describe("signup", () => {
  it("never reflects the auth error text (e.g. 'User already registered')", async () => {
    mocks.signUp.mockResolvedValue({ data: {}, error: { message: "User already registered" } });
    const attempt = signup(form({ email: "e@example.com", password: "long-enough-1" }));
    await expect(attempt).rejects.toThrow(/^\/signup\?message=signupFailed$/);
  });
});
