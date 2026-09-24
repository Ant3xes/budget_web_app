import { NextResponse } from "next/server";

/** Maps a Postgres/PostgREST error to an HTTP response (23514 validation, 23505 duplicate, 42501 RLS). */
export const pgErrorResponse = (error: { code?: string; message: string }) => {
  const status = error.code === "23505" ? 409 : error.code === "42501" ? 403 : 400;
  return NextResponse.json({ error: error.message }, { status });
};
