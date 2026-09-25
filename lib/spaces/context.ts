import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { ACTIVE_SPACE_COOKIE } from "@/lib/spaces/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SpaceKind = "personal" | "shared";
export type SpaceRole = "owner" | "member";

export type SpaceSummary = {
  id: string;
  name: string;
  kind: SpaceKind;
  role: SpaceRole;
};

type MembershipRow = {
  role: SpaceRole;
  spaces: { id: string; name: string; kind: SpaceKind } | { id: string; name: string; kind: SpaceKind }[] | null;
};

/**
 * Everything a request needs to scope its data: the authenticated user, the
 * space they are currently working in, and all the spaces they belong to.
 * Data is scoped with `.eq("space_id", spaceId)` — RLS alone only guarantees
 * the user is a *member*, and a user can be a member of several spaces.
 */
export type SpaceContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: { id: string; email?: string };
  spaceId: string;
  space: SpaceSummary;
  spaces: SpaceSummary[];
};

/**
 * Picks the active space: the one named by the cookie if the user is really a
 * member of it (the cookie is user-controlled, so it is only a hint), else the
 * personal space, else the first one.
 */
export const pickActiveSpace = (spaces: SpaceSummary[], cookieValue: string | undefined) =>
  spaces.find((space) => space.id === cookieValue) ??
  spaces.find((space) => space.kind === "personal") ??
  spaces[0] ??
  null;

const loadSpaceContext = async (): Promise<SpaceContext | null> => {
  const supabase = await createServerSupabaseClient();
  // Local JWT verification (no Auth-server round-trip) — see lib/supabase/middleware.ts.
  // This runs on every navigation; routes that mutate or expose account
  // details re-check with getUser().
  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims;

  if (!claims) {
    return null;
  }

  const user = { id: claims.sub, email: claims.email };

  const { data, error } = await supabase
    .from("space_members")
    .select("role, spaces(id, name, kind)")
    .eq("user_id", user.id);

  // A signed-in user whose spaces cannot be loaded is a server fault, not a
  // logged-out user: returning null here would redirect to /login, which
  // bounces signed-in users straight back (redirect loop).
  if (error) {
    throw new Error(`Unable to load spaces: ${error.message}`);
  }

  const spaces = ((data ?? []) as MembershipRow[])
    .map((row) => {
      const space = Array.isArray(row.spaces) ? row.spaces[0] : row.spaces;
      return space ? { id: space.id, name: space.name, kind: space.kind, role: row.role } : null;
    })
    .filter((space): space is SpaceSummary => space !== null)
    // Personal space first, then shared spaces by name.
    .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "personal" ? -1 : 1));

  const cookieValue = (await cookies()).get(ACTIVE_SPACE_COOKIE)?.value;
  const space = pickActiveSpace(spaces, cookieValue);

  if (!space) {
    // Every user gets a personal space at sign-up (and one in the backfill).
    throw new Error("The signed-in user does not belong to any space.");
  }

  return { supabase, user: { id: user.id, email: user.email }, spaceId: space.id, space, spaces };
};

/** Memoized per request, so a layout and its page share one lookup. */
export const getSpaceContext = cache(loadSpaceContext);

/** For server components: redirects to /login when there is no session. */
export const requireSpaceContext = async (): Promise<SpaceContext> => {
  const context = await getSpaceContext();
  if (!context) {
    redirect("/login");
  }
  return context;
};
