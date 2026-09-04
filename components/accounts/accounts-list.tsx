"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Banknote, Home, Landmark, PiggyBank, Wallet, type LucideIcon } from "lucide-react";

import { AccountModal } from "@/components/accounts/account-modal";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from "@/lib/constants";

type AccountCardData = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balanceCents: number;
  monthExpenseCents: number;
};

interface AccountsListProps {
  accounts: AccountCardData[];
  importButton?: ReactNode;
}

const formatEuros = (cents: number, currency: string) =>
  `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

// Per account-type icon + accent color, so each card reads at a glance
// (courant = current account, épargne/livret = savings-flavored, PEL =
// housing savings plan, autre = fallback).
const ACCOUNT_TYPE_ICONS: Record<(typeof ACCOUNT_TYPES)[number], LucideIcon> = {
  courant: Landmark,
  épargne: PiggyBank,
  livret: Banknote,
  PEL: Home,
  autre: Wallet,
};

const ACCOUNT_TYPE_ACCENTS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  courant: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  épargne: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  livret: "bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  PEL: "bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
  autre: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function AccountsList({ accounts, importButton }: AccountsListProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  const handleSuccess = () => {
    setModalOpen(false);
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Comptes</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Solde = solde initial + somme des transactions non supprimées.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {importButton}
          <button
            onClick={() => setModalOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white shadow hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            aria-label="Nouveau compte"
            title="Nouveau compte"
          >
            <span className="text-lg leading-none">+</span>
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-200 bg-white p-10 text-center text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
          <p className="text-sm">Aucun compte pour l&apos;instant.</p>
          <button
            onClick={() => setModalOpen(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            Créer un compte
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const accountType = account.type as (typeof ACCOUNT_TYPES)[number];
            const Icon = ACCOUNT_TYPE_ICONS[accountType] ?? Wallet;
            const accentClasses = ACCOUNT_TYPE_ACCENTS[accountType] ?? ACCOUNT_TYPE_ACCENTS.autre;

            return (
              <Link
                key={account.id}
                href={`/accounts/${account.id}`}
                className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${accentClasses}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
                      {account.name}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {ACCOUNT_TYPE_LABELS[accountType] ?? account.type}
                    </span>
                  </div>
                </div>

                <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Solde actuel</p>
                  <p
                    className={`mt-0.5 text-2xl font-bold tracking-tight ${
                      account.balanceCents >= 0 ? "text-zinc-900 dark:text-zinc-100" : "text-red-600"
                    }`}
                  >
                    {formatEuros(account.balanceCents, account.currency)}
                  </p>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">Dépenses ce mois</span>
                    {/* No leading "-" (and no red) for a genuinely zero month —
                        a minus sign on 0,00 € misreads as spending, and red is
                        a status color reserved for an actual expense (plan
                        §Étape 5 dark-mode/a11y polish pass). */}
                    <span
                      className={`text-sm font-medium ${
                        account.monthExpenseCents === 0 ? "text-zinc-400 dark:text-zinc-500" : "text-red-500"
                      }`}
                    >
                      {account.monthExpenseCents === 0 ? "" : "-"}
                      {formatEuros(Math.abs(account.monthExpenseCents), account.currency)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <AccountModal
          onClose={() => setModalOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
