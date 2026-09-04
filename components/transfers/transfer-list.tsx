"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { TransferModal } from "@/components/transfers/transfer-modal";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";

type Transfer = {
  transfer_id: string;
  debit_transaction_id: string;
  amount_cents: number;
  currency: string;
  date: string;
  description: string | null;
  from_account: { name: string } | null;
  to_account: { name: string } | null;
};

const PER_PAGE = 25;

const formatAmount = (cents: number, currency: string) =>
  `${currency} ${(Math.abs(cents) / 100).toFixed(2)}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

export function TransferList() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [deletingTransfer, setDeletingTransfer] = useState<Transfer | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totalPages = Math.ceil(total / PER_PAGE);

  const load = useCallback(
    async (p = page) => {
      setIsLoading(true);
      const res = await fetch(`/api/transfers?page=${p}`);
      if (res.ok) {
        const data = (await res.json()) as { transfers: Transfer[]; total: number };
        setTransfers(data.transfers);
        setTotal(data.total);
      }
      setIsLoading(false);
    },
    [page],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch when the page changes
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleDelete = async () => {
    if (!deletingTransfer) return;
    setIsDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/transfers/${deletingTransfer.transfer_id}`, { method: "DELETE" });
    setIsDeleting(false);
    if (res.ok) {
      setDeletingTransfer(null);
      void load(page);
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setDeleteError(data?.error ?? "Erreur lors de la suppression");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Virements</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          + Nouveau virement
        </button>
      </div>

      <div className="rounded-lg bg-white shadow-sm overflow-x-auto dark:bg-zinc-900">
        {isLoading ? (
          <p className="p-6 text-sm text-zinc-500">Chargement…</p>
        ) : transfers.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400">Aucun virement trouvé.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">De</th>
                <th className="px-4 py-3">Vers</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.transfer_id} className="group border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-500">{formatDate(t.date)}</td>
                  <td className="px-4 py-3">{t.from_account?.name ?? "—"}</td>
                  <td className="px-4 py-3">{t.to_account?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500 truncate max-w-xs">{t.description ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-medium whitespace-nowrap text-blue-600">
                    {formatAmount(t.amount_cents, t.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingTransfer(t)}
                        aria-label="Modifier le virement"
                        title="Modifier"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => setDeletingTransfer(t)}
                        aria-label="Supprimer le virement"
                        title="Supprimer"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} itemLabel="virement" />

      {showCreate && (
        <TransferModal
          onSuccess={() => {
            setShowCreate(false);
            void load(1);
            setPage(1);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editingTransfer && (
        <TransferModal
          transferId={editingTransfer.transfer_id}
          defaultValues={{
            amount: String(Math.abs(editingTransfer.amount_cents) / 100),
            date: editingTransfer.date.slice(0, 10),
            description: editingTransfer.description ?? "",
          }}
          onSuccess={() => {
            setEditingTransfer(null);
            void load(page);
          }}
          onClose={() => setEditingTransfer(null)}
        />
      )}

      <AlertDialog
        open={deletingTransfer !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingTransfer(null);
            setDeleteError(null);
          }
        }}
        title="Supprimer ce virement ?"
        description={
          deleteError
            ? deleteError
            : deletingTransfer
              ? `Le virement du ${formatDate(deletingTransfer.date)} (${formatAmount(deletingTransfer.amount_cents, deletingTransfer.currency)}) et ses deux transactions seront supprimés.`
              : undefined
        }
        onConfirm={handleDelete}
        isConfirming={isDeleting}
      />
    </div>
  );
}
