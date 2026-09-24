import { NextResponse } from "next/server";
import { z } from "zod";

import { setActiveSpaceCookie } from "@/lib/spaces/active-cookie";
import { withSpace } from "@/lib/spaces/with-space";

const createSchema = z.object({ name: z.string().trim().min(1).max(80) });

/** Creates a shared space owned by the caller (with its own default categories) and switches to it. */
export async function POST(request: Request) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = createSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { data, error } = await auth.supabase.rpc("create_shared_space", { p_name: payload.data.name });
  if (error || typeof data !== "string") {
    return NextResponse.json({ error: error?.message ?? "Unable to create space" }, { status: 400 });
  }

  await setActiveSpaceCookie(data);
  return NextResponse.json({ id: data });
}
