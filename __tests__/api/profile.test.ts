import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll: () => [],
      set: vi.fn(),
    }),
  ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PATCH } from "@/app/api/profile/route";

const mockUser = { id: "user-test-id", email: "test@budget.local" };

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const res = await PATCH(patchRequest({ full_name: "Romain" }));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("updates full_name and returns profile", async () => {
    const queryChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: mockUser.id, full_name: "Romain" },
        error: null,
      }),
    };

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn(() => queryChain),
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const res = await PATCH(patchRequest({ full_name: "Romain" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { profile: { full_name: string } };
    expect(body.profile.full_name).toBe("Romain");
    expect(queryChain.update).toHaveBeenCalledWith({ full_name: "Romain" });
  });

  it("returns 400 for empty full_name", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const res = await PATCH(patchRequest({ full_name: "" }));
    expect(res.status).toBe(400);
  });

  it("changes password after successful re-auth", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    const updateUser = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        signInWithPassword,
        updateUser,
      },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const res = await PATCH(
      patchRequest({
        current_password: "Password1234!",
        new_password: "NewPassword1!",
        confirm: "NewPassword1!",
      }),
    );

    expect(res.status).toBe(200);
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: mockUser.email,
      password: "Password1234!",
    });
    expect(updateUser).toHaveBeenCalledWith({ password: "NewPassword1!" });
  });

  it("returns 400 when current password is incorrect", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    const updateUser = vi.fn();

    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        signInWithPassword,
        updateUser,
      },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const res = await PATCH(
      patchRequest({
        current_password: "WrongPassword!",
        new_password: "NewPassword1!",
        confirm: "NewPassword1!",
      }),
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Mot de passe actuel incorrect");
    expect(updateUser).not.toHaveBeenCalled();
  });
});
