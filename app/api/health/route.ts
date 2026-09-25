import { NextResponse } from "next/server";

// Public liveness probe used by the post-deploy smoke test
// (.github/workflows/smoke.yml). Deliberately touches no database and
// returns no configuration: it only proves the deployed app is serving.
// `commit` is the Git SHA Vercel built (public information: the repository is
// public), so the smoke test can check it is testing the deployment it was
// triggered for and not the previous one.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
