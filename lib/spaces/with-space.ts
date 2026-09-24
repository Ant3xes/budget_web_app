import { getSpaceContext } from "@/lib/spaces/context";

/**
 * Route-handler entry point (replaces the per-route `withUser()` helpers).
 * Returns `null` when unauthenticated — callers answer 401.
 *
 * Usage:
 *   const auth = await withSpace();
 *   if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   auth.supabase.from("accounts").select().eq("space_id", auth.spaceId);
 *   auth.supabase.from("accounts").insert({ space_id: auth.spaceId, user_id: auth.user.id, ... });
 */
export const withSpace = async () => getSpaceContext();
