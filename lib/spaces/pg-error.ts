import { NextResponse } from "next/server";

import { demoReadOnlyResponse } from "@/lib/api/demo";
import { logApiError } from "@/lib/api/log-error";

/**
 * Maps a Postgres/PostgREST error to an HTTP response.
 * - 23514 (check_violation), 23505 (duplicate) and 42501 (RLS) are the business
 *   outcomes the SQL functions/triggers raise on purpose: status mapped and
 *   message returned as is.
 * - anything else -> generic 400; the details only go to the server log,
 *   truncated (issue 163).
 */
export const pgErrorResponse = (error: { code?: string; message: string }) => {
  if (error.code === "42501" && error.message === "demo account is read-only") return demoReadOnlyResponse();
  if (error.code === "23514" || error.code === "23505" || error.code === "42501") {
    return NextResponse.json({ error: error.message }, { status: error.code === "23505" ? 409 : error.code === "42501" ? 403 : 400 });
  }
  logApiError("[pg-error]", error);
  return NextResponse.json({ error: "Request failed" }, { status: 400 });
};
