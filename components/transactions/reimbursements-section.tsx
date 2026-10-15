"use client";

import { useEffect, useState } from "react";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatDate, formatEuros } from "@/lib/format";
import { sumReimbursements } from "@/lib/transactions/net-amount";

// Reimbursement links in the transaction modal (ADR 0004, issue 123).
type Row = { id: string; date: string; description: string | null; amount_cents: number; currency: string };

async function setLink(incomingId: string, expenseId: string | null): Promise<boolean> {
  const res = await fetch(`/api/transactions/${incomingId}/reimburses`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expense_id: expenseId }),
  });
  return res.ok;
}

/** Expense modal: the incoming transactions linked to it, plus a picker to add one. */
export function ExpenseReimbursements({ expenseId }: { expenseId: string }) {
  const { t } = useLocale();
  const [linked, setLinked] = useState<Row[]>([]);
  const [candidates, setCandidates] = useState<Row[]>([]);
  const [choice, setChoice] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Bumped after each change to re-run the loading effect.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [linkedRes, candidatesRes] = await Promise.all([
        fetch(`/api/transactions/${expenseId}/reimburses`),
        fetch("/api/transactions/reimbursement-candidates?for=incoming"),
      ]);
      if (linkedRes.ok) setLinked(((await linkedRes.json()) as { reimbursements: Row[] }).reimbursements ?? []);
      if (candidatesRes.ok) setCandidates(((await candidatesRes.json()) as { transactions: Row[] }).transactions ?? []);
    };
    void load();
  }, [expenseId, version]);

  const change = async (incomingId: string, target: string | null) => {
    setError(null);
    if (!(await setLink(incomingId, target))) {
      setError(t("transactions.reimbursements.saveError"));
      return;
    }
    setChoice("");
    setVersion((v) => v + 1);
  };

  const total = sumReimbursements(linked.map((r) => r.amount_cents));

  return (
    <section className="space-y-2 rounded-md border border-border p-3" aria-label={t("transactions.reimbursements.title")}>
      <h3 className="text-sm font-medium">{t("transactions.reimbursements.title")}</h3>
      {linked.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("transactions.reimbursements.empty")}</p>
      ) : (
        <>
          <ul className="space-y-1 text-sm">
            {linked.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {r.description} · {formatDate(r.date)} · {formatEuros(r.amount_cents, r.currency)}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => void change(r.id, null)}>
                  {t("transactions.reimbursements.remove")}
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {t("transactions.reimbursements.total", { amount: formatEuros(total) })}
          </p>
        </>
      )}
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("transactions.reimbursements.noCandidates")}</p>
      ) : (
        <div className="flex gap-2">
          <Select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label={t("transactions.reimbursements.add")}>
            <option value="">{t("transactions.reimbursements.choose")}</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.description} · {formatDate(c.date)} · {formatEuros(c.amount_cents, c.currency)}
              </option>
            ))}
          </Select>
          <Button type="button" variant="outline" disabled={!choice} onClick={() => void change(choice, expenseId)}>
            {t("transactions.reimbursements.add")}
          </Button>
        </div>
      )}
      {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </section>
  );
}

/** Income modal: which expense this entry reimburses (or none). */
export function IncomeReimburses({ incomeId }: { incomeId: string }) {
  const { t } = useLocale();
  const [target, setTarget] = useState<Row | null>(null);
  const [candidates, setCandidates] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [linkRes, candidatesRes] = await Promise.all([
        fetch(`/api/transactions/${incomeId}/reimburses`),
        fetch(`/api/transactions/reimbursement-candidates?for=expense&exclude=${incomeId}`),
      ]);
      if (linkRes.ok) setTarget(((await linkRes.json()) as { target: Row | null }).target ?? null);
      if (candidatesRes.ok) setCandidates(((await candidatesRes.json()) as { transactions: Row[] }).transactions ?? []);
    };
    void load();
  }, [incomeId, version]);

  const change = async (expenseId: string | null) => {
    setError(null);
    if (!(await setLink(incomeId, expenseId))) {
      setError(t("transactions.reimbursements.saveError"));
      return;
    }
    setVersion((v) => v + 1);
  };

  // The current target may be older than the candidate window: keep it selectable.
  const options = target && !candidates.some((c) => c.id === target.id) ? [target, ...candidates] : candidates;

  return (
    <label className="block text-sm font-medium">
      {t("transactions.reimbursements.reimbursesTitle")}
      <Select className="mt-1" value={target?.id ?? ""} onChange={(e) => void change(e.target.value || null)}>
        <option value="">{t("transactions.reimbursements.reimbursesNone")}</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.description} · {formatDate(c.date)} · {formatEuros(Math.abs(c.amount_cents), c.currency)}
          </option>
        ))}
      </Select>
      <span className="mt-1 block text-xs font-normal text-muted-foreground">
        {t("transactions.reimbursements.reimbursesHint")}
      </span>
      {error ? <span className="mt-1 block text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </label>
  );
}
