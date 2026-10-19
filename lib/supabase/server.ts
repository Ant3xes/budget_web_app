import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";
import { cookies } from "next/headers";

import { getSupabaseConfig } from "@/lib/supabase/config";

export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
};
