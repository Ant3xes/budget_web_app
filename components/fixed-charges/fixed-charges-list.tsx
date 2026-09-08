"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { FixedChargeModal } from "@/components/fixed-charges/fixed-charges-modal";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleStatusChange = async (id: string, status: FixedCharge["status"]) => {
    setOpenMenuId(null);
    const res = await fetch(`/api/fixed-charges/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await loadData();
  };

  const handleMarkPaid = async (id: string) => {
    setOpenMenuId(null);
    const res = await fetch(`/api/fixed-charges/${id}/pay`, { method: "POST" });
    if (res.ok) await loadData();
  };

  const handleDelete = async (id: string) => {
    setOpenMenuId(null);
    if (!confirm(t("fixedCharges.deleteConfirm"))) return;
    const res = await fetch(`/api/fixed-charges/${id}`, { method: "DELETE" });
    if (res.ok) await loadData();
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
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t("fixedCharges.newCharge")}
        </button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-zinc-500">{t("common.state.loading")}</p>
      ) : charges.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-600">
          <p className="text-zinc-500">{t("fixedCharges.empty")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm dark:bg-zinc-900">
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
                          onClick={() => handleDelete(charge.id)}
                          aria-label={t("fixedCharges.deleteCharge")}
                          title={t("common.actions.delete")}
                        >
                          <Trash2 />
                        </Button>
                        <div className="relative inline-block" ref={openMenuId === charge.id ? menuRef : null}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setOpenMenuId(openMenuId === charge.id ? null : charge.id)}
                            aria-label={t("fixedCharges.otherActions")}
                            title={t("fixedCharges.otherActions")}
                          >
                            <MoreVertical />
                          </Button>
                          {openMenuId === charge.id && (
                            <div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                              {charge.status === "active" && (
                                <button
                                  onClick={() => handleMarkPaid(charge.id)}
                                  className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-zinc-50"
                                >
                                  {t("fixedCharges.markPaid")}
                                </button>
                              )}
                              {charge.status === "active" && (
                                <button
                                  onClick={() => handleStatusChange(charge.id, "suspended")}
                                  className="w-full px-4 py-2 text-left text-sm text-yellow-700 hover:bg-zinc-50"
                                >
                                  {t("fixedCharges.suspend")}
                                </button>
                              )}
                              {charge.status === "suspended" && (
                                <button
                                  onClick={() => handleStatusChange(charge.id, "active")}
                                  className="w-full px-4 py-2 text-left text-sm text-green-700 hover:bg-zinc-50"
                                >
                                  {t("fixedCharges.reactivate")}
                                </button>
                              )}
                              {charge.status !== "cancelled" && (
                                <button
                                  onClick={() => handleStatusChange(charge.id, "cancelled")}
                                  className="w-full px-4 py-2 text-left text-sm text-zinc-500 hover:bg-zinc-50"
                                >
                                  {t("fixedCharges.markCancelled")}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
    </div>
  );
}
