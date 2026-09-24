import { NextResponse } from "next/server";
import { z } from "zod";

import { setActiveSpaceCookie } from "@/lib/spaces/active-cookie";
import { withSpace } from "@/lib/spaces/with-space";

const switchSchema = z.object({ spaceId: z.guid() });

/** Switches the space the app is scoped to. Only spaces the caller belongs to are accepted. */
export async function POST(request: Request) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = switchSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid space id" }, { status: 400 });
  }

  if (!auth.spaces.some((space) => space.id === payload.data.spaceId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await setActiveSpaceCookie(payload.data.spaceId);
  return NextResponse.json({ ok: true });
}
