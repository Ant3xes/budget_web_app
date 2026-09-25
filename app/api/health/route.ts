import { NextResponse } from "next/server";

// Public liveness probe used by the post-deploy smoke test
// (.github/workflows/smoke.yml). Deliberately touches no database and
// returns no configuration: it only proves the deployed app is serving.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
