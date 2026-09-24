import { cookies } from "next/headers";

import { ACTIVE_SPACE_COOKIE } from "@/lib/spaces/constants";

/**
 * Remembers the active space. Only a hint: `pickActiveSpace()` re-checks
 * membership on every request. Must be called from a Route Handler or a
 * Server Action (cookies cannot be written while rendering).
 */
export const setActiveSpaceCookie = async (spaceId: string) => {
  (await cookies()).set(ACTIVE_SPACE_COOKIE, spaceId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
};
