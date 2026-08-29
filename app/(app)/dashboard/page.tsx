import { createServerSupabaseClient } from "@/lib/supabase/server";
import { IncomeExpenseBarChart } from "@/components/dashboard/bar-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { computeIncomeExpenseSeries } from "@/lib/accounts/compute-income-expense-series";

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}

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
      const color = catObj?.color ?? "#94a3b8";
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
    .map((b) => ({
      id: b.id,
      categoryName:
        (b.categories as unknown as { name: string; color: string | null; icon: string | null } | null)?.name ??
        "Sans catégorie",
      categoryIcon:
        (b.categories as unknown as { name: string; color: string | null; icon: string | null } | null)?.icon ?? null,
      amount: b.amount_cents,
      consumed: budgetConsumption[b.category_id] ?? 0,
    }))
    .sort((a, b) => {
      const ra = a.amount > 0 ? a.consumed / a.amount : 0;
      const rb = b.amount > 0 ? b.consumed / b.amount : 0;
      return rb - ra;
    });

  // ── Alerts ───────────────────────────────────────────────────────────────
  const upcomingCharges = fixedChargesAlertRes.data ?? [];
  const exceededBudgets = budgetRows.filter((b) => b.consumed > b.amount);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Alert banners */}
      {(upcomingCharges.length > 0 || exceededBudgets.length > 0) && (
        <div className="space-y-2">
          {upcomingCharges.map((charge) => (
            <div
              key={charge.id}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
            >
              <span>⚠</span>
              <span>
                Charge fixe <strong>{charge.name}</strong> ({formatEuros(charge.amount_cents)}) — échéance le{" "}
                {formatDate(charge.next_due_date)}
              </span>
            </div>
          ))}
          {exceededBudgets.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700"
            >
              <span>📊</span>
              <span>
                Budget <strong>{b.categoryName}</strong> dépassé — {formatEuros(b.consumed)} /{" "}
                {formatEuros(b.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
          <h2 className="text-sm text-zinc-500 dark:text-zinc-400">Solde consolidé</h2>
          <p className={`mt-1 text-xl font-semibold ${consolidatedBalance < 0 ? "text-red-600" : "text-zinc-900 dark:text-zinc-100"}`}>
            {formatEuros(consolidatedBalance)}
          </p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
          <h2 className="text-sm text-zinc-500 dark:text-zinc-400">Dépenses ce mois</h2>
          <p className="mt-1 text-xl font-semibold text-red-600">−{formatEuros(monthExpense)}</p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
          <h2 className="text-sm text-zinc-500 dark:text-zinc-400">Revenus ce mois</h2>
          <p className="mt-1 text-xl font-semibold text-green-600">+{formatEuros(monthIncome)}</p>
        </article>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Dépenses par catégorie (mois en cours)</h2>
          <DonutChart data={donutData} emptyLabel="Aucune dépense ce mois" />
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Revenus vs Dépenses (6 mois)</h2>
          <IncomeExpenseBarChart data={barData} />
        </article>
      </div>

      {/* Budget utilization */}
      {budgetRows.length > 0 && (
        <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Budgets du mois en cours</h2>
          <div className="space-y-3">
            {budgetRows.map((b) => {
              const ratio = b.amount > 0 ? b.consumed / b.amount : 0;
              const pct = Math.min(ratio * 100, 100);
              const barColor =
                ratio > 1 ? "bg-red-500" : ratio >= 0.8 ? "bg-orange-400" : "bg-green-500";
              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      {b.categoryIcon && <span className="mr-1">{b.categoryIcon}</span>}
                      {b.categoryName}
                    </span>
                    <span className="text-zinc-500">
                      {formatEuros(b.consumed)} / {formatEuros(b.amount)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-zinc-100">
                    <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      )}

      {/* Last 10 transactions */}
      <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Dernières transactions</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(last10Res.data ?? []).map((tx) => (
            <li key={tx.id} className="flex justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
              <span className="truncate max-w-xs text-zinc-700 dark:text-zinc-300">
                {tx.description ?? "Transaction"}
                {(tx.categories as unknown as { name: string } | null)?.name && (
                  <span className="ml-1.5 text-xs text-zinc-400">
                    · {(tx.categories as unknown as { name: string }).name}
                  </span>
                )}
              </span>
              <span className={`ml-4 shrink-0 font-medium ${tx.amount_cents < 0 ? "text-red-600" : "text-green-600"}`}>
                {tx.amount_cents < 0 ? "−" : "+"}
                {formatEuros(Math.abs(tx.amount_cents))}
              </span>
            </li>
          ))}
          {!last10Res.data?.length && <li className="text-zinc-500">Aucune transaction.</li>}
        </ul>
      </article>
    </section>
  );
}
