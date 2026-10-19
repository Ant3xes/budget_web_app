import { NextResponse } from "next/server";

/** Stable client sentinel; never expose raw database errors (issue 166). */
export const demoReadOnlyResponse = () => NextResponse.json(
  { error: "Compte demo en lecture seule", code: "DEMO_READ_ONLY" },
  { status: 403 },
);
