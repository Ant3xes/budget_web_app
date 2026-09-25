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
  cancelled: "bg-muted text-muted-foreground",
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

  const renderMoreMenu = (charge: FixedCharge) => (
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
  );

  const activeCharges = charges.filter((c) => c.status === "active");
  const totalMonthly = activeCharges.reduce((sum, c) => sum + monthlyEquivalent(c), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            {t("fixedCharges.totalMonthlyEstimate")}{" "}
            <span className="font-semibold text-foreground">{formatEuros(totalMonthly)}</span>
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>{t("fixedCharges.newCharge")}</Button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("common.state.loading")}</p>
      ) : charges.length === 0 ? (
        <EmptyState title={t("fixedCharges.empty")} />
      ) : (
        <>
        {/* Cards (< md) */}
        <ul className="space-y-2 md:hidden">
          {charges.map((charge) => {
            const dueSoon = charge.status === "active" && isDueSoon(charge.next_due_date);
            return (
              <li
                key={charge.id}
                className={`rounded-2xl p-3 ring-1 ring-foreground/10 ${dueSoon ? "bg-red-50 dark:bg-red-900/20" : "bg-card"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {charge.categories?.icon && <span>{charge.categories.icon}</span>}
                      <span className="min-w-0 break-words">{charge.name}</span>
                    </p>
                    {charge.notes && <p className="mt-0.5 truncate text-xs text-muted-foreground">{charge.notes}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold whitespace-nowrap">{formatEuros(charge.amount_cents)}</p>
                    {charge.frequency !== "monthly" && (
                      <p className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatEuros(monthlyEquivalent(charge))} / {t("fixedCharges.table.monthlyEquivalent")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className={dueSoon ? "font-semibold text-red-700 dark:text-red-400" : ""}>
                      {formatFixedChargeDate(charge.next_due_date)}
                    </span>
                    <span>{t(`fixedCharges.frequency.${charge.frequency}`)}</span>
                    {charge.accounts?.name && <span className="truncate">{charge.accounts.name}</span>}
                    <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[charge.status]}`}>
                      {t(`fixedCharges.status.${charge.status}`)}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-1">
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
                    {renderMoreMenu(charge)}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Table (>= md) */}
        <Card className="hidden overflow-x-auto p-0 md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase">
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
                    className={`border-b border-border/50 hover:bg-muted/50 ${dueSoon ? "bg-red-50 dark:bg-red-900/20" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      <span className="flex items-center gap-1.5">
                        {charge.categories?.icon && <span>{charge.categories.icon}</span>}
                        {charge.name}
                      </span>
                      {charge.notes && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate max-w-xs">{charge.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{formatEuros(charge.amount_cents)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {charge.frequency !== "monthly" ? formatEuros(monthlyEquivalent(charge)) : "—"}
                    </td>
                    <td className="px-4 py-3">{t(`fixedCharges.frequency.${charge.frequency}`)}</td>
                    <td className={`px-4 py-3 ${dueSoon ? "font-semibold text-red-700 dark:text-red-400" : ""}`}>
                      {formatFixedChargeDate(charge.next_due_date)}
                      {dueSoon && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-red-600">
                          <AlertTriangle className="h-3 w-3" /> {t("fixedCharges.dueSoon")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{charge.accounts?.name ?? "—"}</td>
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
                        {renderMoreMenu(charge)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        </>
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
