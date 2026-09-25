import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseConfig } from "@/lib/supabase/config";

export const updateSession = async (request: NextRequest) => {
  let response = NextResponse.next({
    request,
  });

  if (!hasSupabaseConfig) {
    return { response, user: null };
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // getClaims() checks the JWT signature locally against the project's cached
  // JWKS (asymmetric signing keys) instead of calling the Auth server on every
  // request like getUser(). It still refreshes an expiring session. Trade-off:
  // a revoked session stays valid until its access token expires; RLS still
  // verifies the JWT on every data query, and sensitive routes re-check with
  // getUser().
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ? { id: data.claims.sub, email: data.claims.email } : null;

  return { response, user };
};
