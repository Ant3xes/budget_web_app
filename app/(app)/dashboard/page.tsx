import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AlertBanners } from "@/components/dashboard/alert-banners";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { ExpenseByCategoryWidget } from "@/components/dashboard/expense-by-category-widget";
import { IncomeVsExpenseWidget } from "@/components/dashboard/income-vs-expense-widget";
import { BudgetUtilization } from "@/components/dashboard/budget-utilization";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { computeIncomeExpenseSeries } from "@/lib/accounts/compute-income-expense-series";
import { CATEGORY_COLOR_FALLBACK } from "@/lib/constants";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
  const nextMonthStart =
    currentMonth === 12
      ? `${currentYear + 1}-01-01`
      : `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;

  // 6 months ago start
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().slice(0, 10);

  const [accountsRes, monthTxRes, last10Res, barChartRes, budgetsRes, fixedChargesAlertRes] =
    await Promise.all([
      // 1. Accounts with their transactions for correct balance calculation
      supabase
        .from("accounts")
        .select("id, name, initial_balance_cents")
        .is("deleted_at", null),

      // 2. Current month transactions for donut + KPIs
      supabase
        .from("transactions")
        .select("kind, amount_cents, category_id, categories(name, color)")
        .in("kind", ["expense", "income"])
        .gte("date", monthStart)
        .lt("date", nextMonthStart)
        .is("deleted_at", null),

      // 3. Last 10 transactions
      supabase
        .from("transactions")
        .select("id, amount_cents, date, description, kind, categories(name)")
        .is("deleted_at", null)
        .not("kind", "in", '("transfer_debit","transfer_credit")')
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10),

      // 4. Last 6 months for bar chart
      supabase
        .from("transactions")
        .select("kind, amount_cents, date")
        .in("kind", ["expense", "income"])
        .gte("date", sixMonthsAgoStr)
        .is("deleted_at", null),

      // 5. Budgets for current month (with consumption)
      supabase
        .from("budgets")
        .select("id, category_id, amount_cents, categories(name, color, icon)")
        .eq("month", monthStart)
        .is("deleted_at", null),

      // 6. Upcoming fixed charges (active, due in ≤ 7 days)
      supabase
        .from("fixed_charges")
        .select("id, name, next_due_date, amount_cents")
        .eq("status", "active")
        .lte("next_due_date", new Date(now.getTime() + 7 * 86400 * 1000).toISOString().slice(0, 10))
        .is("deleted_at", null)
        .order("next_due_date", { ascending: true }),
    ]);

  // ── Consolidated balance (correct: per account) ──────────────────────────
  const accountIds = (accountsRes.data ?? []).map((a) => a.id);
  let accountTxTotals: Record<string, number> = {};
  if (accountIds.length > 0) {
    const { data: txTotals } = await supabase
      .from("transactions")
      .select("account_id, amount_cents")
      .in("account_id", accountIds)
      .is("deleted_at", null);
    accountTxTotals = (txTotals ?? []).reduce<Record<string, number>>((acc, tx) => {
      acc[tx.account_id] = (acc[tx.account_id] ?? 0) + tx.amount_cents;
      return acc;
    }, {});
  }
  const consolidatedBalance = (accountsRes.data ?? []).reduce(
    (sum, acc) => sum + acc.initial_balance_cents + (accountTxTotals[acc.id] ?? 0),
    0,
  );

  // ── Current month KPIs ───────────────────────────────────────────────────
  const monthTx = monthTxRes.data ?? [];
  const monthExpense = monthTx
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + Math.abs(t.amount_cents), 0);
  const monthIncome = monthTx
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + t.amount_cents, 0);

  // ── Donut chart data ─────────────────────────────────────────────────────
  const expenseByCat = monthTx
    .filter((t) => t.kind === "expense")
    .reduce<Record<string, { name: string; value: number; color: string }>>((acc, tx) => {
      const catObj = tx.categories as unknown as { name: string; color: string | null } | null;
      const catName = catObj?.name ?? "Sans catégorie";
      const color = catObj?.color ?? CATEGORY_COLOR_FALLBACK;
      if (!acc[catName]) acc[catName] = { name: catName, value: 0, color };
      acc[catName]!.value += Math.abs(tx.amount_cents);
      return acc;
    }, {});
  const donutData = Object.values(expenseByCat).sort((a, b) => b.value - a.value);

  // ── Bar chart data (6 months) ─────────────────────────────────────────────
  const barData = computeIncomeExpenseSeries(barChartRes.data ?? []);

  // ── Budget utilization ───────────────────────────────────────────────────
  const budgets = budgetsRes.data ?? [];
  const budgetCatIds = budgets.map((b) => b.category_id).filter(Boolean);
  let budgetConsumption: Record<string, number> = {};
  if (budgetCatIds.length > 0) {
    const { data: consumptionData } = await supabase
      .from("transactions")
      .select("category_id, amount_cents")
      .eq("kind", "expense")
      .in("category_id", budgetCatIds)
      .gte("date", monthStart)
      .lt("date", nextMonthStart)
      .is("deleted_at", null);
    budgetConsumption = (consumptionData ?? []).reduce<Record<string, number>>((acc, tx) => {
      if (tx.category_id) acc[tx.category_id] = (acc[tx.category_id] ?? 0) + Math.abs(tx.amount_cents);
      return acc;
    }, {});
  }

  const budgetRows = budgets
    .map((b) => {
      const category = b.categories as unknown as { name: string; color: string | null; icon: string | null } | null;
      return {
        id: b.id,
        categoryName: category?.name ?? "Sans catégorie",
        categoryIcon: category?.icon ?? null,
        categoryColor: category?.color ?? null,
        amount: b.amount_cents,
        consumed: budgetConsumption[b.category_id] ?? 0,
      };
    })
    .sort((a, b) => {
      const ra = a.amount > 0 ? a.consumed / a.amount : 0;
      const rb = b.amount > 0 ? b.consumed / b.amount : 0;
      return rb - ra;
    });

  // ── Alerts ───────────────────────────────────────────────────────────────
  const upcomingCharges = fixedChargesAlertRes.data ?? [];
  const exceededBudgets = budgetRows.filter((b) => b.consumed > b.amount);

  const recentTransactions = (last10Res.data ?? []).map((tx) => ({
    id: tx.id,
    amount_cents: tx.amount_cents,
    description: tx.description,
    categories: tx.categories as unknown as { name: string } | null,
  }));

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <AlertBanners upcomingCharges={upcomingCharges} exceededBudgets={exceededBudgets} />

      <KpiRow consolidatedBalance={consolidatedBalance} monthExpense={monthExpense} monthIncome={monthIncome} />

      <div className="grid gap-4 md:grid-cols-2">
        <ExpenseByCategoryWidget data={donutData} />
        <IncomeVsExpenseWidget data={barData} />
      </div>

      <BudgetUtilization rows={budgetRows} />

      <RecentTransactions transactions={recentTransactions} />
    </section>
  );
}
