import type { Metadata } from "next";

import { requireSpaceContext } from "@/lib/spaces/context";
import { T } from "@/components/i18n/t";
import { FilterSheet } from "@/components/ui/filter-sheet";
import { PeriodSelector } from "@/components/period-selector";
import { AccountSelector } from "@/components/dashboard/account-selector";
import { BankTiles } from "@/components/dashboard/bank-tiles";
import { ConsolidatedBalanceTile } from "@/components/dashboard/consolidated-balance-tile";
import { ExpenseByCategoryWidget } from "@/components/dashboard/expense-by-category-widget";
import { ExpenseIncomeLine } from "@/components/dashboard/expense-income-line";
import { IncomeVsExpenseWidget } from "@/components/dashboard/income-vs-expense-widget";
import { BudgetStackedChart } from "@/components/dashboard/budget-stacked-chart";
import { FixedChargesSummary } from "@/components/dashboard/fixed-charges-summary";
import { SavingsGoalsSummary } from "@/components/dashboard/savings-goals-summary";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { RemainingToLive } from "@/components/dashboard/remaining-to-live";
import { SavingsThisMonth } from "@/components/dashboard/savings-this-month";
import { loadDashboardData } from "@/lib/dashboard/load-dashboard-data";

export const metadata: Metadata = {
  title: "Tableau de bord",
  description: "Vue d'ensemble de vos comptes, dépenses et objectifs du mois.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; accounts?: string }>;
}) {
  const { supabase, spaceId, space } = await requireSpaceContext();
  // All loading (and every Supabase error, thrown by unwrap → error.tsx) lives in
  // lib/dashboard/load-dashboard-data.ts; this page only lays the widgets out.
  const {
    period,
    periodParam,
    accountsParam,
    includeShared,
    currentMonthValue,
    courantAccounts,
    selectedCourantIds,
    consolidatedBalance,
    bankGroups,
    courantBalanceCents,
    remainingToLiveAfterChargesCents,
    savingsThisMonthCents,
    periodExpense,
    periodIncome,
    donutData: donutDataWithMeta,
    donutTransactionsByCategory,
    barData,
    trendIsFloored,
    budgetRows,
    budgetTransactionsByCategory,
    fixedChargeRows,
    upcomingFixedChargesCents,
    goalSummaries,
    recentTransactions,
  } = await loadDashboardData({ supabase, spaceId, spaceKind: space.kind, searchParams: await searchParams });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          <T k="dashboard.title" />
        </h1>
        <div className="hidden md:block">
          <PeriodSelector current={period} basePath="/dashboard" accountsParam={accountsParam} />
        </div>
        <FilterSheet className="md:hidden" triggerLabelKey="common.filters.trigger" titleKey="common.filters.title">
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              <T k="dashboard.filters.periodLabel" />
            </p>
            <PeriodSelector current={period} basePath="/dashboard" accountsParam={accountsParam} />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              <T k="dashboard.filters.accountsLabel" />
            </p>
            <AccountSelector
              accounts={courantAccounts}
              selectedIds={selectedCourantIds}
              basePath="/dashboard"
              periodParam={periodParam}
            />
          </div>
        </FilterSheet>
      </div>
      {space.kind === "shared" ? (
        <p className="-mt-2 text-sm text-muted-foreground">
          <T k={includeShared ? "dashboard.sharedNote" : "dashboard.sharedNoteFiltered"} />
        </p>
      ) : null}

      {/* Zone comptes — solde consolidé + bulles banques (elles-mêmes déjà
          dans leur propre "grosse bulle", voir bank-tiles.tsx), seule
          chose que ce panneau montre : une vue d'ensemble en lecture seule
          du patrimoine, sans aucun contrôle interactif à l'intérieur. Le
          sélecteur de comptes n'a rien à y faire — il filtre les widgets
          *en dessous* (activité/période), pas ce panneau (toujours calculé
          sur l'ensemble des comptes) — il vit donc désormais dans sa propre
          barre, juste au-dessus de ce qu'il filtre réellement. */}
      <div className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/10">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          <T k="dashboard.accountsOverview.heading" />
        </h2>

        {/* Solde consolidé + bulles banques (remplace l'ancien bloc "Comptes par banque").
            `-my-1`/`py-1` (removed again at `sm:`, where overflow switches to
            visible) give the tiles' ring/shadow room to paint — without it,
            `overflow-x-auto`'s implicit `overflow-y: auto` clips it top and
            bottom on mobile. */}
        <div className="-mx-4 -my-1 flex snap-x snap-mandatory items-stretch gap-3 no-scrollbar overflow-x-auto px-4 py-1 sm:mx-0 sm:my-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0">
          <ConsolidatedBalanceTile amountCents={consolidatedBalance} />
          <BankTiles groups={bankGroups} />
        </div>
      </div>

      {/* Barre de filtre — distincte du panneau "vue d'ensemble" ci-dessus,
          collée à la grille de widgets qu'elle filtre effectivement. Sur
          mobile, ce même sélecteur vit dans le FilterSheet ci-dessus. */}
      <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
        <AccountSelector
          accounts={courantAccounts}
          selectedIds={selectedCourantIds}
          basePath="/dashboard"
          periodParam={periodParam}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3 [&>*]:min-w-0">
        <RemainingToLive amountCents={courantBalanceCents} afterChargesCents={remainingToLiveAfterChargesCents} />
        <ExpenseIncomeLine
          periodExpense={periodExpense}
          periodIncome={periodIncome}
          period={period}
          currentMonthValue={currentMonthValue}
        />
        <SavingsThisMonth amountCents={savingsThisMonthCents} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <ExpenseByCategoryWidget
          data={donutDataWithMeta}
          period={period}
          currentMonthValue={currentMonthValue}
          transactionsByCategory={donutTransactionsByCategory}
        />
        <IncomeVsExpenseWidget
          data={barData}
          period={period}
          currentMonthValue={currentMonthValue}
          trendIsFloored={trendIsFloored}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <BudgetStackedChart rows={budgetRows} transactionsByCategory={budgetTransactionsByCategory} />
        <FixedChargesSummary charges={fixedChargeRows} totalCents={upcomingFixedChargesCents} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <RecentTransactions transactions={recentTransactions} />
        <SavingsGoalsSummary goals={goalSummaries} />
      </div>
    </section>
  );
}
