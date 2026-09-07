import { ProfileForm } from "@/components/settings/profile-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { T } from "@/components/i18n/t";

export default async function ProfileSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
    : { data: null };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        <T k="profile.title" />
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        <T k="profile.description" />
      </p>
      <div className="mt-6">
        <ProfileForm initialFullName={profile?.full_name ?? ""} />
      </div>
    </div>
  );
}
