import { NextResponse } from "next/server";
import { z } from "zod";

import { setActiveSpaceCookie } from "@/lib/spaces/active-cookie";
import { withSpace } from "@/lib/spaces/with-space";

const createSchema = z.object({ name: z.string().trim().min(1).max(80) });

/** Lists the caller's spaces with their default split and member count. */
export async function GET() {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ids = auth.spaces.map((space) => space.id);
  const [spacesResult, membersResult] = await Promise.all([
    auth.supabase.from("spaces").select("id, default_share_percent").in("id", ids),
    auth.supabase.from("space_members").select("space_id").in("space_id", ids),
  ]);
  if (spacesResult.error || membersResult.error) {
    return NextResponse.json(
      { error: spacesResult.error?.message ?? membersResult.error?.message ?? "Unable to load spaces" },
      { status: 400 },
    );
  }

  const percentById = new Map((spacesResult.data ?? []).map((row) => [row.id, row.default_share_percent]));
  const countById = new Map<string, number>();
  for (const row of membersResult.data ?? []) {
    countById.set(row.space_id, (countById.get(row.space_id) ?? 0) + 1);
  }

  return NextResponse.json({
    spaces: auth.spaces.map((space) => ({
      id: space.id,
      name: space.name,
      kind: space.kind,
      role: space.role,
      default_share_percent: percentById.get(space.id) ?? 50,
      member_count: countById.get(space.id) ?? 1,
    })),
  });
}

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
