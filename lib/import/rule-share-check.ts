import { NextResponse } from "next/server";

import type { SpaceContext } from "@/lib/spaces/context";

/**
 * Pre-checks a rule's sharing target so the client gets a clean 400/403 before
 * the database trigger would raise. Returns a response to send, or null when fine.
 */
export function checkRuleShare(
  auth: Pick<SpaceContext, "space" | "spaces">,
  kind: string,
  shareSpaceId: string,
): NextResponse | null {
  if (kind !== "expense") {
    return NextResponse.json({ error: "Seules les règles de dépense peuvent partager" }, { status: 400 });
  }
  if (auth.space.kind !== "personal") {
    return NextResponse.json({ error: "Le partage n'est possible que depuis un espace personnel" }, { status: 400 });
  }
  if (!auth.spaces.some((space) => space.id === shareSpaceId && space.kind === "shared")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
