import { redirect } from "next/navigation";

import { BalanceCard } from "@/components/balance/balance-card";
import { SettlementList, type SettlementItem } from "@/components/balance/settlement-list";
import { SettlementModal } from "@/components/balance/settlement-modal";
import { SharedExpenseList, type SharedExpenseItem } from "@/components/balance/shared-expense-list";
import { T } from "@/components/i18n/t";
import { computeBalances, suggestTransfers } from "@/lib/shared-expenses/balance";
import { fetchAllPages } from "@/lib/shared-expenses/fetch-all-pages";
import { owedCents, type Shares } from "@/lib/shared-expenses/split-shares";
import { requireSpaceContext } from "@/lib/spaces/context";

type MemberRow = {
  user_id: string;
  role: "owner" | "member";
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

type CategoryRow = {
  name: string;
  color: string | null;
  icon: string | null;
  is_default: boolean | null;
  translation_key: string | null;
};

type ExpenseRow = {
  id: string;
  paid_by: string;
  amount_cents: number;
  currency: string;
  date: string;
  description: string | null;
  category_id: string | null;
  shares: Shares;
  categories: CategoryRow | CategoryRow[] | null;
};

export default async function BalancePage() {
  const { supabase, user, space, spaceId } = await requireSpaceContext();
  if (space.kind !== "shared") {
    redirect("/dashboard");
  }

  // The lists below are capped for display, but the balance must count every
  // row, so it reads its own (light, paginated) copy of the data.
  const [{ data: memberRows }, { data: expenseRows }, { data: settlementRows }, balanceExpenses, balanceSettlements] =
    await Promise.all([
    supabase.from("space_members").select("user_id, role, profiles(full_name)").eq("space_id", spaceId),
    supabase
      .from("shared_expenses")
      .select(
        "id, paid_by, amount_cents, currency, date, description, category_id, shares, categories(name, color, icon, is_default, translation_key)",
      )
      .eq("space_id", spaceId)
      .order("date", { ascending: false })
      .limit(200),
    supabase
      .from("settlements")
      .select("id, from_user, to_user, amount_cents, date, created_by")
      .eq("space_id", spaceId)
      .order("date", { ascending: false })
      .limit(100),
    fetchAllPages((from, to) =>
      supabase
        .from("shared_expenses")
        .select("paid_by, amount_cents, shares")
        .eq("space_id", spaceId)
        .order("id")
        .range(from, to),
    ),
    fetchAllPages((from, to) =>
      supabase
        .from("settlements")
        .select("from_user, to_user, amount_cents")
        .eq("space_id", spaceId)
        .order("id")
        .range(from, to),
    ),
  ]);

  const members = ((memberRows ?? []) as MemberRow[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { userId: row.user_id, name: profile?.full_name ?? "?" };
  });
  const nameOf = (userId: string) => members.find((member) => member.userId === userId)?.name ?? "?";

  const expenses = (expenseRows ?? []) as unknown as ExpenseRow[];
  const settlements = settlementRows ?? [];

  // Every member appears, even with no activity.
  const balances: Record<string, number> = Object.fromEntries(members.map((member) => [member.userId, 0]));
  for (const [userId, cents] of Object.entries(
    computeBalances(balanceExpenses as unknown as ExpenseRow[], balanceSettlements),
  )) {
    balances[userId] = cents;
  }
  const transfers = suggestTransfers(balances);

  const expenseItems: SharedExpenseItem[] = expenses.map((expense) => {
    const category = Array.isArray(expense.categories) ? expense.categories[0] : expense.categories;
    const myPercent = expense.shares?.[user.id] ?? 0;
    return {
      id: expense.id,
      paidBy: expense.paid_by,
      paidByName: nameOf(expense.paid_by),
      amountCents: expense.amount_cents,
      currency: expense.currency,
      date: expense.date,
      description: expense.description,
      myShareCents: owedCents(expense.amount_cents, myPercent),
      category: category
        ? {
            name: category.name,
            color: category.color,
            is_default: category.is_default,
            translation_key: category.translation_key,
          }
        : null,
    };
  });

  const settlementItems: SettlementItem[] = settlements.map((settlement) => ({
    id: settlement.id,
    fromName: nameOf(settlement.from_user),
    toName: nameOf(settlement.to_user),
    amountCents: settlement.amount_cents,
    date: settlement.date,
    createdBy: settlement.created_by,
  }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          <T k="balance.title" />
        </h1>
        <SettlementModal members={members} currentUserId={user.id} transfers={transfers} />
      </div>

      <BalanceCard members={members} balances={balances} transfers={transfers} currentUserId={user.id} />
      <SharedExpenseList expenses={expenseItems} currentUserId={user.id} />
      <SettlementList settlements={settlementItems} currentUserId={user.id} />
    </section>
  );
}
