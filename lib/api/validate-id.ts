import { NextResponse } from "next/server";

import { uuidSchema } from "@/lib/validation/uuid";

/** Returns a 400 response when `id` is not a UUID, otherwise null (issue 163). */
export const invalidIdResponse = (id: string) => {
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  return uuidSchema.safeParse(id).success ? null : NextResponse.json({ error: "Invalid id" }, { status: 400 });
};
