import { notFound } from "next/navigation";

import { AccountForm } from "@/components/accounts/account-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function EditAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, name, type, initial_balance_cents, currency")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!data) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Edit account</h1>
      <article className="max-w-md rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
        <AccountForm
          accountId={data.id}
          defaultValues={{
            name: data.name,
            type: data.type,
            initialBalanceCents: data.initial_balance_cents,
            currency: data.currency,
          }}
        />
      </article>
    </section>
  );
}
