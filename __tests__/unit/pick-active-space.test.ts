import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

import { pickActiveSpace, type SpaceSummary } from "@/lib/spaces/context";

const personal: SpaceSummary = { id: "p", name: "Personnel", kind: "personal", role: "owner" };
const shared: SpaceSummary = { id: "s", name: "Foyer", kind: "shared", role: "member" };

describe("pickActiveSpace", () => {
  it("honours the cookie when the user is a member of that space", () => {
    expect(pickActiveSpace([personal, shared], "s")).toBe(shared);
  });

  it("ignores a cookie naming a space the user does not belong to", () => {
    expect(pickActiveSpace([personal, shared], "someone-elses-space")).toBe(personal);
  });

  it("falls back to the personal space without a cookie", () => {
    expect(pickActiveSpace([shared, personal], undefined)).toBe(personal);
  });

  it("falls back to the first space when there is no personal one", () => {
    expect(pickActiveSpace([shared], undefined)).toBe(shared);
  });

  it("returns null when the user belongs to no space", () => {
    expect(pickActiveSpace([], "s")).toBeNull();
  });
});
