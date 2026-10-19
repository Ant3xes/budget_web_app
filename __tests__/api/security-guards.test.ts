import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

import { POST as confirm } from "@/app/api/import/confirm/route";
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, POST as preview } from "@/app/api/import/preview/route";
import { POST as pay } from "@/app/api/fixed-charges/[id]/pay/route";
import { PATCH as patchBudget, DELETE as deleteBudget } from "@/app/api/budgets/[id]/route";
import { PATCH as patchProfile } from "@/app/api/profile/route";
import { escapeLike } from "@/lib/api/escape-like";
import { logApiError } from "@/lib/api/log-error";
import { pgErrorResponse } from "@/lib/spaces/pg-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withSpace } from "@/lib/spaces/with-space";

const authed = () =>
  vi.mocked(withSpace).mockResolvedValue({
    supabase: { from: vi.fn() },
    user: { id: "u" },
    spaceId: "s",
    space: { kind: "personal" },
    spaces: [],
  } as never);

const upload = (content: BlobPart, name: string, type = "text/csv") => {
  const body = new FormData();
  body.append("file", new File([content], name, { type }));
  return new Request("http://localhost/api/import/preview", { method: "POST", body });
};

beforeEach(() => {
  vi.clearAllMocks();
  authed();
});

describe("import preview guards (issue 163)", () => {
  it("rejects a 3 MB file with 413", async () => {
    const res = await preview(upload("x".repeat(3 * 1024 * 1024), "big.csv"));
    expect(res.status).toBe(413);
  });

  it("rejects on the declared Content-Length before reading the body", async () => {
    const request = new Request("http://localhost/api/import/preview", {
      method: "POST",
      headers: { "content-length": String(3 * 1024 * 1024) },
      body: "irrelevant",
    });
    expect((await preview(request)).status).toBe(413);
  });

  it("accepts a file exactly at the limit (size guard only)", async () => {
    const res = await preview(upload("x".repeat(MAX_IMPORT_BYTES), "edge.csv"));
    expect(res.status).toBe(400); // passes the size guard, then fails on format
  });

  it("returns 400 when the body is not a valid form", async () => {
    const request = new Request("http://localhost/api/import/preview", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=zzz" },
      body: "not multipart",
    });
    expect((await preview(request)).status).toBe(400);
  });

  it("rejects an unexpected extension and an unexpected MIME type", async () => {
    expect((await preview(upload("a", "evil.exe", "application/x-msdownload"))).status).toBe(400);
    const res = await preview(upload("a", "data.csv", "application/x-msdownload"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Type de fichier non supporté" });
  });

  it("rejects more than the allowed number of parsed rows with 422", async () => {
    const header = "Booking Date,Partner Name,Type,Amount (EUR)";
    const lines = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `2026-01-01,Shop ${i},Presentment,-1.00`);
    const res = await preview(upload([header, ...lines].join("\n"), "many.csv"));
    expect(res.status).toBe(422);
  });
});

describe("import confirm guards (issue 163)", () => {
  it("returns 400 on invalid JSON", async () => {
    const res = await confirm(new Request("http://localhost/api/import/confirm", { method: "POST", body: "{nope" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });
});

describe("route id validation (issue 163)", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it("rejects a non-UUID id with 400 before touching the database", async () => {
    const res = await pay(new Request("http://localhost/x", { method: "POST" }), params("charge-1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid id" });
    expect((await deleteBudget(new Request("http://localhost/x", { method: "DELETE" }), params("1; drop"))).status).toBe(400);
  });

  it("returns 400 on invalid JSON in a [id] PATCH", async () => {
    const res = await patchBudget(new Request("http://localhost/x", { method: "PATCH", body: "{" }), params("00000000-0000-4000-8000-0000000000c1"));
    expect(res.status).toBe(400);
  });
});

describe("profile body validation (issue 163)", () => {
  it("rejects invalid JSON and non-object bodies with 400", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u" } } }) },
      from: vi.fn(),
    } as never);
    for (const body of ["{", "[1]", "null", '"str"']) {
      const res = await patchProfile(new Request("http://localhost/api/profile", { method: "PATCH", body }));
      expect(res.status).toBe(400);
    }
  });
});

describe("ilike escaping (issue 163)", () => {
  it("escapes %, _ and the backslash", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(escapeLike("plain")).toBe("plain");
  });
});

describe("error responses and logs (issue 163)", () => {
  it("does not return the raw Postgres message for non-business errors, and logs a truncated one", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = pgErrorResponse({ code: "23503", message: `insert on table "transactions" violates ${"x".repeat(500)}` });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Request failed" });
    expect(String(log.mock.calls[0]![0]).length).toBeLessThan(300);
    expect(String(log.mock.calls[0]![0])).toContain("23503");
    log.mockRestore();
  });

  it("keeps business messages for check violations", async () => {
    const res = pgErrorResponse({ code: "23514", message: "share given to a non-member" });
    expect(await res.json()).toEqual({ error: "share given to a non-member" });
  });

  it("logs only the code and a truncated message, never the object", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    logApiError("ctx", { code: "XX", message: "m".repeat(1000), details: "secret bank line" });
    const args = log.mock.calls[0]!;
    expect(args).toHaveLength(1);
    expect(String(args[0])).not.toContain("secret");
    expect(String(args[0]).length).toBeLessThan(260);
    log.mockRestore();
  });
});
