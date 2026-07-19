"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AccountModal } from "@/components/accounts/account-modal";
import { ACCOUNT_TYPES } from "@/lib/constants";

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
}

const formatEuros = (cents: number, currency: string) =>
  `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  courant: "Courant",
  épargne: "Épargne",
  livret: "Livret",
  PEL: "PEL",
  autre: "Autre",
};

export function AccountsList({ accounts }: AccountsListProps) {
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
        <button
          onClick={() => setModalOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white shadow hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          aria-label="Nouveau compte"
          title="Nouveau compte"
        >
          <span className="text-lg leading-none">+</span>
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center text-zinc-400 dark:text-zinc-500">
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
          {accounts.map((account) => (
            <Link
              key={account.id}
              href={`/accounts/${account.id}`}
              className="group rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
                    {account.name}
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {TYPE_LABELS[account.type as (typeof ACCOUNT_TYPES)[number]] ?? account.type}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">Solde actuel</span>
                  <span
                    className={`text-sm font-semibold ${
                      account.balanceCents >= 0 ? "text-zinc-900 dark:text-zinc-100" : "text-red-600"
                    }`}
                  >
                    {formatEuros(account.balanceCents, account.currency)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">Dépenses ce mois</span>
                  <span className="text-sm font-medium text-red-500">
                    -{formatEuros(Math.abs(account.monthExpenseCents), account.currency)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
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
