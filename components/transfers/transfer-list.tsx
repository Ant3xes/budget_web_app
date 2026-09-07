"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { TransferModal } from "@/components/transfers/transfer-modal";
import { useLocale } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatEuros } from "@/lib/format";

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

export function TransferList() {
  const { t } = useLocale();
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
      setDeleteError(data?.error ?? t("transactions.errors.deleteGeneric"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("transactions.transfers.title")}</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          {t("transactions.transfers.newButton")}
        </button>
      </div>

      <div className="rounded-lg bg-white shadow-sm overflow-x-auto dark:bg-zinc-900">
        {isLoading ? (
          <p className="p-6 text-sm text-zinc-500">{t("common.state.loading")}</p>
        ) : transfers.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400">{t("transactions.transfers.empty")}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                <th className="px-4 py-3">{t("transactions.transfers.date")}</th>
                <th className="px-4 py-3">{t("transactions.transfers.from")}</th>
                <th className="px-4 py-3">{t("transactions.transfers.to")}</th>
                <th className="px-4 py-3">{t("transactions.transfers.description")}</th>
                <th className="px-4 py-3 text-left">{t("transactions.transfers.amount")}</th>
                <th className="px-4 py-3">{t("transactions.transfers.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((tr) => (
                <tr key={tr.transfer_id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-500">{formatDate(tr.date)}</td>
                  <td className="px-4 py-3">{tr.from_account?.name ?? "—"}</td>
                  <td className="px-4 py-3">{tr.to_account?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500 truncate max-w-xs">{tr.description ?? "—"}</td>
                  <td className="px-4 py-3 text-left font-medium whitespace-nowrap text-blue-600">
                    {formatEuros(Math.abs(tr.amount_cents), tr.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditingTransfer(tr)}
                        aria-label={t("transactions.transfers.edit")}
                        title={t("common.actions.edit")}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => setDeletingTransfer(tr)}
                        aria-label={t("transactions.transfers.delete")}
                        title={t("common.actions.delete")}
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

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} itemLabel={t("transactions.transfers.itemLabel")} />

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
        title={t("transactions.transfers.deleteConfirmTitle")}
        description={
          deleteError
            ? deleteError
            : deletingTransfer
              ? t("transactions.transfers.deleteConfirmDescription", {
                  date: formatDate(deletingTransfer.date),
                  amount: formatEuros(Math.abs(deletingTransfer.amount_cents), deletingTransfer.currency),
                })
              : undefined
        }
        onConfirm={handleDelete}
        isConfirming={isDeleting}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
      />
    </div>
  );
}
