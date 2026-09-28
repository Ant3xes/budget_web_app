"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { nextQuery, safeNext } from "@/lib/auth/safe-next";
import {
  checkRateLimit,
  createRateLimitStore,
  recordFailedAttempt,
  resetAttempts,
} from "@/lib/auth/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Module-scope: persists across requests handled by the same warm lambda
// instance (see lib/auth/rate-limit.ts for the persistence caveat), reset on
// cold start. Separate stores so a burst of signups can't lock out login.
const loginAttempts = createRateLimitStore();
const signupAttempts = createRateLimitStore();

/** Best-effort client IP from the standard proxy header Vercel sets; falls back to a shared bucket if absent (e.g. local dev). */
const clientIp = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

const rateLimitKey = async (email: string) => `${email.toLowerCase()}:${await clientIp()}`;

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const key = await rateLimitKey(email);
  if (!checkRateLimit(loginAttempts, key).allowed) {
    redirect(`/login?message=rateLimited${nextQuery(next, "&")}`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    recordFailedAttempt(loginAttempts, key);
    redirect(`/login?message=${encodeURIComponent(error.message)}${nextQuery(next, "&")}`);
  }

  resetAttempts(loginAttempts, key);
  revalidatePath("/", "layout");
  redirect(next ?? "/dashboard");
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const key = await rateLimitKey(email);
  if (!checkRateLimit(signupAttempts, key).allowed) {
    redirect(`/signup?message=rateLimited${nextQuery(next, "&")}`);
  }

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
    recordFailedAttempt(signupAttempts, key);
    redirect(`/signup?message=${encodeURIComponent(error.message)}${nextQuery(next, "&")}`);
  }

  resetAttempts(signupAttempts, key);

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
