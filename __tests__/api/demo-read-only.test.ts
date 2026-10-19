import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));
import { withSpace } from "@/lib/spaces/with-space";
import { POST } from "@/app/api/transactions/route";
import { PATCH, DELETE } from "@/app/api/transactions/[id]/route";
import { pgErrorResponse } from "@/lib/spaces/pg-error";

describe("demo read-only responses", () => {
  it("maps the demo RPC permission error to a localizable 403", async () => {
    const res = pgErrorResponse({ code: "42501", message: "demo account is read-only" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Compte demo en lecture seule", code: "DEMO_READ_ONLY" });
  });
  it.each([POST, PATCH, DELETE])("rejects demo mutations before even attempting a zero-row write", async (handler) => {
    const from = vi.fn();
    vi.mocked(withSpace).mockResolvedValue({ isDemo: true, supabase: { from } } as never);
    const res = await handler(new Request("http://localhost/api/transactions", { method: "POST" }), { params: Promise.resolve({ id: "unused" }) });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Compte demo en lecture seule", code: "DEMO_READ_ONLY" });
    expect(from).not.toHaveBeenCalled();
  });
});

// Every persistent space mutation must reject demo writes, including endpoints
// whose database UPDATE/DELETE would otherwise report success with zero rows.
const apiRoot = resolve(process.cwd(), "app/api");
const mutations = readdirSync(apiRoot, { recursive: true })
  .filter((file): file is string => typeof file === "string" && file.endsWith("route.ts"))
  .filter((file) => !["spaces/active/route.ts", "import/preview/route.ts", "profile/route.ts"].includes(file))
  .filter((file) => /export async function (POST|PUT|PATCH|DELETE)\(/.test(readFileSync(resolve(apiRoot, file), "utf8")));

it.each(mutations)("rejects every demo mutation in %s before database access", async (file) => {
  const from = vi.fn();
  const rpc = vi.fn();
  vi.mocked(withSpace).mockResolvedValue({ isDemo: true, supabase: { from, rpc } } as never);
  const routePath = resolve(apiRoot, file);
  const route = await import(/* @vite-ignore */ routePath);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    const handler = route[method];
    if (typeof handler !== "function") continue;
    const response = await handler(new Request("http://localhost/api/test", { method }), { params: Promise.resolve({ id: "unused", userId: "unused" }) });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Compte demo en lecture seule", code: "DEMO_READ_ONLY" });
  }
  expect(from).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
