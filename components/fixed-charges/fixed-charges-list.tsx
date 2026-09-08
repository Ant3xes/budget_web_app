"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { FixedChargeModal } from "@/components/fixed-charges/fixed-charges-modal";
import { useLocale } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { formatEuros } from "@/lib/format";
import { formatFixedChargeDate, isDueSoon } from "@/lib/fixed-charges/due-date";

type FixedCharge = {
  id: string;
  name: string;
  amount_cents: number;
  currency: string;
  frequency: "monthly" | "quarterly" | "yearly";
  next_due_date: string;
  status: "active" | "suspended" | "cancelled";
  notes: string | null;
  account_id: string | null;
  category_id: string | null;
  accounts: { name: string } | null;
  categories: { name: string; color: string | null; icon: string | null } | null;
};

function monthlyEquivalent(charge: FixedCharge): number {
  if (charge.frequency === "monthly") return charge.amount_cents;
  if (charge.frequency === "quarterly") return Math.round(charge.amount_cents / 3);
  return Math.round(charge.amount_cents / 12);
}

const STATUS_COLORS = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  suspended: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  cancelled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
} as const;

export function FixedChargesList() {
  const { t } = useLocale();
  const [charges, setCharges] = useState<FixedCharge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCharge, setEditingCharge] = useState<FixedCharge | null>(null);
  const [deletingCharge, setDeletingCharge] = useState<FixedCharge | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch("/api/fixed-charges");
    if (res.ok) {
      const data = (await res.json()) as { charges: FixedCharge[] };
      setCharges(data.charges ?? []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void loadData();
  }, [loadData]);

  const handleStatusChange = async (id: string, status: FixedCharge["status"]) => {
    const res = await fetch(`/api/fixed-charges/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await loadData();
  };

  const handleMarkPaid = async (id: string) => {
    const res = await fetch(`/api/fixed-charges/${id}/pay`, { method: "POST" });
    if (res.ok) await loadData();
  };

  const handleDelete = async () => {
    if (!deletingCharge) return;
    setIsDeleting(true);
    const res = await fetch(`/api/fixed-charges/${deletingCharge.id}`, { method: "DELETE" });
    setIsDeleting(false);
    if (res.ok) {
      setDeletingCharge(null);
      await loadData();
    }
  };

  const activeCharges = charges.filter((c) => c.status === "active");
  const totalMonthly = activeCharges.reduce((sum, c) => sum + monthlyEquivalent(c), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">
            {t("fixedCharges.totalMonthlyEstimate")}{" "}
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">{formatEuros(totalMonthly)}</span>
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>{t("fixedCharges.newCharge")}</Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-zinc-500">{t("common.state.loading")}</p>
      ) : charges.length === 0 ? (
        <EmptyState title={t("fixedCharges.empty")} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500 uppercase dark:border-zinc-700 dark:text-zinc-400">
                <th className="px-4 py-3">{t("fixedCharges.table.name")}</th>
                <th className="px-4 py-3 text-right">{t("fixedCharges.table.amount")}</th>
                <th className="px-4 py-3 text-right">{t("fixedCharges.table.monthlyEquivalent")}</th>
                <th className="px-4 py-3">{t("fixedCharges.table.frequency")}</th>
                <th className="px-4 py-3">{t("fixedCharges.table.nextDueDate")}</th>
                <th className="px-4 py-3">{t("fixedCharges.table.account")}</th>
                <th className="px-4 py-3">{t("fixedCharges.table.status")}</th>
                <th className="px-4 py-3 text-right">{t("fixedCharges.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {charges.map((charge) => {
                const dueSoon = charge.status === "active" && isDueSoon(charge.next_due_date);
                return (
                  <tr
                    key={charge.id}
                    className={`border-b border-zinc-50 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800 ${dueSoon ? "bg-red-50 dark:bg-red-900/20" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-1.5">
                        {charge.categories?.icon && <span>{charge.categories.icon}</span>}
                        {charge.name}
                      </span>
                      {charge.notes && (
                        <p className="mt-0.5 text-xs text-zinc-400 truncate max-w-xs">{charge.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{formatEuros(charge.amount_cents)}</td>
                    <td className="px-4 py-3 text-right text-zinc-500">
                      {charge.frequency !== "monthly" ? formatEuros(monthlyEquivalent(charge)) : "—"}
                    </td>
                    <td className="px-4 py-3">{t(`fixedCharges.frequency.${charge.frequency}`)}</td>
                    <td className={`px-4 py-3 ${dueSoon ? "font-semibold text-red-700 dark:text-red-400" : ""}`}>
                      {formatFixedChargeDate(charge.next_due_date)}
                      {dueSoon && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-red-500">
                          <AlertTriangle className="h-3 w-3" /> {t("fixedCharges.dueSoon")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{charge.accounts?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[charge.status]}`}>
                        {t(`fixedCharges.status.${charge.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditingCharge(charge)}
                          aria-label={t("fixedCharges.editCharge")}
                          title={t("common.actions.edit")}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => setDeletingCharge(charge)}
                          aria-label={t("fixedCharges.deleteCharge")}
                          title={t("common.actions.delete")}
                        >
                          <Trash2 />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                            aria-label={t("fixedCharges.otherActions")}
                            title={t("fixedCharges.otherActions")}
                          >
                            <MoreVertical />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {charge.status === "active" && (
                              <DropdownMenuItem
                                onClick={() => handleMarkPaid(charge.id)}
                                className="text-green-700 dark:text-green-400"
                              >
                                {t("fixedCharges.markPaid")}
                              </DropdownMenuItem>
                            )}
                            {charge.status === "active" && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(charge.id, "suspended")}
                                className="text-yellow-700 dark:text-yellow-400"
                              >
                                {t("fixedCharges.suspend")}
                              </DropdownMenuItem>
                            )}
                            {charge.status === "suspended" && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(charge.id, "active")}
                                className="text-green-700 dark:text-green-400"
                              >
                                {t("fixedCharges.reactivate")}
                              </DropdownMenuItem>
                            )}
                            {charge.status !== "cancelled" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(charge.id, "cancelled")}>
                                {t("fixedCharges.markCancelled")}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {showCreate && (
        <FixedChargeModal
          onSuccess={async () => { setShowCreate(false); await loadData(); }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editingCharge && (
        <FixedChargeModal
          chargeId={editingCharge.id}
          defaultValues={{
            name: editingCharge.name,
            amount_cents: editingCharge.amount_cents,
            frequency: editingCharge.frequency,
            next_due_date: editingCharge.next_due_date,
            account_id: editingCharge.account_id,
            category_id: editingCharge.category_id,
            notes: editingCharge.notes,
          }}
          onSuccess={async () => { setEditingCharge(null); await loadData(); }}
          onClose={() => setEditingCharge(null)}
        />
      )}

      <AlertDialog
        open={deletingCharge !== null}
        onOpenChange={(open) => !open && setDeletingCharge(null)}
        title={t("fixedCharges.deleteConfirm")}
        onConfirm={handleDelete}
        isConfirming={isDeleting}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
      />
    </div>
  );
}
