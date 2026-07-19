import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const nameSchema = z.object({
  full_name: z.string().trim().min(1).max(100),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(6),
    new_password: z.string().min(8),
    confirm: z.string(),
  })
  .refine((data) => data.confirm === data.new_password, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirm"],
  });

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return { supabase, user };
};

export async function PATCH(request: Request) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as Record<string, unknown>;

  if ("full_name" in body) {
    const payload = nameSchema.safeParse(body);
    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message ?? "Invalid data" },
        { status: 400 },
      );
    }

    const { data, error } = await auth.supabase
      .from("profiles")
      .update({ full_name: payload.data.full_name })
      .eq("id", auth.user.id)
      .select("id, full_name")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ profile: data });
  }

  if ("current_password" in body || "new_password" in body) {
    const payload = passwordSchema.safeParse(body);
    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message ?? "Invalid data" },
        { status: 400 },
      );
    }

    const email = auth.user.email;
    if (!email) {
      return NextResponse.json({ error: "Email utilisateur introuvable" }, { status: 400 });
    }

    const { error: reauthError } = await auth.supabase.auth.signInWithPassword({
      email,
      password: payload.data.current_password,
    });

    if (reauthError) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
    }

    const { error: updateError } = await auth.supabase.auth.updateUser({
      password: payload.data.new_password,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid data" }, { status: 400 });
}
