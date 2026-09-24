"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { nextQuery, safeNext } from "@/lib/auth/safe-next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}${nextQuery(next, "&")}`);
  }

  revalidatePath("/", "layout");
  redirect(next ?? "/dashboard");
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`
        : undefined,
    },
  });

  if (error) {
    redirect(`/signup?message=${encodeURIComponent(error.message)}${nextQuery(next, "&")}`);
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next ?? "/dashboard");
  }

  redirect(`/login?message=signupSuccess${nextQuery(next, "&")}`);
}

export async function logout() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/login");
}
