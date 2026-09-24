"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { BalanceMember, BalanceTransfer } from "@/components/balance/types";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { formatDate, formatEuros } from "@/lib/format";

type Candidate = { id: string; date: string; description: string | null; amount_cents: number };
type Direction = "paid" | "received";

const MANUAL = "__manual__";

const todayIso = () => new Date().toISOString().slice(0, 10);

/** "12,50" or "12.50" -> 1250 cents, or null when not a positive amount. */
const parseCents = (raw: string): number | null => {
  const value = Number(raw.trim().replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return cents > 0 ? cents : null;
};

function SettlementForm({
  members,
  currentUserId,
  transfers,
  onDone,
}: {
  members: BalanceMember[];
  currentUserId: string;
  transfers: BalanceTransfer[];
  onDone: () => void;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const others = members.filter((member) => member.userId !== currentUserId);

  // Pre-fill from the first suggested transfer involving me.
  const suggestion = transfers.find((transfer) => transfer.from === currentUserId || transfer.to === currentUserId);
  const [direction, setDirection] = useState<Direction>(suggestion?.to === currentUserId ? "received" : "paid");
  const [otherId, setOtherId] = useState(
    suggestion ? (suggestion.from === currentUserId ? suggestion.to : suggestion.from) : (others[0]?.userId ?? ""),
  );
  const [amount, setAmount] = useState(suggestion ? (suggestion.amount_cents / 100).toFixed(2) : "");
  const [date, setDate] = useState(todayIso());
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<string>(MANUAL);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Received payments are only relevant (and only fetched) when I am the receiver.
  useEffect(() => {
    if (direction !== "received" || candidates !== null) return;
    let cancelled = false;
    fetch("/api/settlements/candidates")
      .then((response) => (response.ok ? response.json() : { transactions: [] }))
      .then((body: { transactions?: Candidate[] }) => {
        if (!cancelled) setCandidates(body.transactions ?? []);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [direction, candidates]);

  const useCandidate = direction === "received" && selected !== MANUAL;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const body: Record<string, unknown> = {
      from_user: direction === "paid" ? currentUserId : otherId,
      to_user: direction === "paid" ? otherId : currentUserId,
    };

    if (useCandidate) {
      body.source_transaction_id = selected;
    } else {
      const cents = parseCents(amount);
      if (cents === null) return setError(t("balance.modal.errorAmount"));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError(t("balance.modal.errorDate"));
      body.amount_cents = cents;
      body.date = date;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? t("balance.modal.errorGeneric"));
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setError(t("balance.modal.errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4">
      <div role="radiogroup" aria-label={t("balance.modal.direction")} className="grid grid-cols-2 gap-2">
        {(["paid", "received"] as const).map((value) => (
          <Button
            key={value}
            type="button"
            role="radio"
            aria-checked={direction === value}
            variant={direction === value ? "default" : "outline"}
            onClick={() => setDirection(value)}
          >
            {t(value === "paid" ? "balance.modal.iPaid" : "balance.modal.iReceived")}
          </Button>
        ))}
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">
          {t(direction === "paid" ? "balance.modal.otherMemberPaid" : "balance.modal.otherMemberReceived")}
        </span>
        <Select value={otherId} onChange={(event) => setOtherId(event.target.value)} required>
          {others.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </Select>
      </label>

      {direction === "received" ? (
        <fieldset className="space-y-2 text-sm">
          <legend className="font-medium">{t("balance.modal.candidatesHeading")}</legend>
          {candidates === null ? (
            <p className="text-muted-foreground">{t("balance.modal.candidatesLoading")}</p>
          ) : (
            <>
              {candidates.length === 0 ? (
                <p className="text-muted-foreground">{t("balance.modal.candidatesEmpty")}</p>
              ) : null}
              {candidates.map((candidate) => (
                <label
                  key={candidate.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2"
                >
                  <input
                    type="radio"
                    name="candidate"
                    value={candidate.id}
                    checked={selected === candidate.id}
                    onChange={() => setSelected(candidate.id)}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {formatDate(candidate.date)} · {candidate.description ?? "—"}
                  </span>
                  <span className="shrink-0 font-medium">{formatEuros(candidate.amount_cents)}</span>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2">
                <input
                  type="radio"
                  name="candidate"
                  value={MANUAL}
                  checked={selected === MANUAL}
                  onChange={() => setSelected(MANUAL)}
                />
                <span>{t("balance.modal.manualOption")}</span>
              </label>
            </>
          )}
        </fieldset>
      ) : null}

      {!useCandidate ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t("balance.modal.amount")}</span>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0,00"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t("balance.modal.date")}</span>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {t("balance.modal.cancel")}
        </Button>
        <Button type="submit" disabled={busy || others.length === 0}>
          {busy ? t("balance.modal.submitting") : t("balance.modal.submit")}
        </Button>
      </div>
    </form>
  );
}

/** "Record a settlement" button + modal. The form only mounts while open, so it resets each time. */
export function SettlementModal({
  members,
  currentUserId,
  transfers,
}: {
  members: BalanceMember[];
  currentUserId: string;
  transfers: BalanceTransfer[];
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("balance.modal.open")}</Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={t("balance.modal.title")}
        description={t("balance.modal.description")}
        closeLabel={t("balance.modal.close")}
      >
        <SettlementForm
          members={members}
          currentUserId={currentUserId}
          transfers={transfers}
          onDone={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
