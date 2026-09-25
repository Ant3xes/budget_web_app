"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useLocale } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { formatEuros } from "@/lib/format";
import { resolveCategoryName } from "@/lib/i18n/category-name";

type SpaceOption = { id: string; name: string; kind: "personal" | "shared"; default_share_percent: number | null };
type Category = {
  id: string;
  name: string;
  kind: string;
  icon?: string | null;
  is_default?: boolean;
  translation_key?: string | null;
};

export type ExistingShare = {
  id: string;
  spaceId: string;
  categoryId: string | null;
  /** The payer's saved share; when known, editing starts from it. */
  payerSharePercent?: number;
};

interface ShareTransactionModalProps {
  transactionId: string;
  /** Absolute value is used. */
  amountCents: number;
  currency?: string;
  /** Set to edit an existing share (change category / split, or unshare). */
  existing?: ExistingShare;
  onSuccess: () => void;
  onClose: () => void;
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
const round2 = (value: number) => Math.round(value * 100) / 100;

const readError = async (res: Response, fallback: string) => {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
};

export function ShareTransactionModal({
  transactionId,
  amountCents,
  currency = "EUR",
  existing,
  onSuccess,
  onClose,
}: ShareTransactionModalProps) {
  const { t } = useLocale();
  const isEdit = !!existing;

  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [spacesLoaded, setSpacesLoaded] = useState(false);
  const [spaceId, setSpaceId] = useState(existing?.spaceId ?? "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? "");
  const [shareInput, setShareInput] = useState(
    existing?.payerSharePercent !== undefined ? String(existing.payerSharePercent) : "50",
  );
  // A saved share is never overwritten by the space default.
  const [shareTouched, setShareTouched] = useState(existing?.payerSharePercent !== undefined);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmUnshare, setConfirmUnshare] = useState(false);
  const [isUnsharing, setIsUnsharing] = useState(false);

  const sharedSpaces = spaces.filter((s) => s.kind === "shared");

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/spaces");
      if (res.ok) {
        const data = (await res.json()) as { spaces: SpaceOption[] };
        const shared = (data.spaces ?? []).filter((s) => s.kind === "shared");
        setSpaces(data.spaces ?? []);
        // Preselect when there is no ambiguity.
        setSpaceId((current) => current || (shared.length === 1 ? shared[0].id : ""));
      }
      setSpacesLoaded(true);
    };
    void load();
  }, []);

  // Default my-share follows the chosen space until the user edits it.
  useEffect(() => {
    if (shareTouched) return;
    const space = spaces.find((s) => s.id === spaceId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived default until the user types
    if (space) setShareInput(String(space.default_share_percent ?? 50));
  }, [spaceId, spaces, shareTouched]);

  useEffect(() => {
    if (!spaceId) return;
    let cancelled = false;
    const load = async () => {
      const res = await fetch(`/api/spaces/${spaceId}/categories`);
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as { categories: Category[] };
        setCategories((data.categories ?? []).filter((c) => c.kind === "expense"));
      } else {
        setCategories([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const parsedShare = shareInput.trim() === "" ? NaN : Number(shareInput.replace(",", "."));
  const shareValid = Number.isFinite(parsedShare) && parsedShare >= 0 && parsedShare <= 100;
  const me = shareValid ? clampPercent(round2(parsedShare)) : 0;
  const others = round2(100 - me);
  const absCents = Math.abs(amountCents);
  const myCents = Math.round((absCents * me) / 100);
  const otherCents = absCents - myCents;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!shareValid) {
      setError(t("sharedExpenses.modal.shareInvalid"));
      return;
    }
    if (!spaceId) return;
    setIsSubmitting(true);
    const category = categoryId || null;
    const res = existing
      ? await fetch(`/api/shared-expenses/${existing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category_id: category, payer_share_percent: me }),
        })
      : await fetch("/api/shared-expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction_id: transactionId,
            space_id: spaceId,
            category_id: category,
            payer_share_percent: me,
          }),
        });
    setIsSubmitting(false);
    if (!res.ok) {
      setError(await readError(res, t("sharedExpenses.modal.saveError")));
      return;
    }
    onSuccess();
  };

  const onUnshare = async () => {
    if (!existing) return;
    setIsUnsharing(true);
    setError(null);
    const res = await fetch(`/api/shared-expenses/${existing.id}`, { method: "DELETE" });
    setIsUnsharing(false);
    if (!res.ok) {
      setConfirmUnshare(false);
      setError(await readError(res, t("sharedExpenses.modal.unshareError")));
      return;
    }
    onSuccess();
  };

  const noSharedSpace = spacesLoaded && sharedSpaces.length === 0;

  return (
    <>
      <Modal
        open
        onOpenChange={(next) => !next && onClose()}
        title={t(isEdit ? "sharedExpenses.modal.titleEdit" : "sharedExpenses.modal.titleNew")}
        closeLabel={t("common.actions.close")}
      >
        {noSharedSpace ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("sharedExpenses.modal.noSharedSpace")}</p>
            <Link href="/invitations" className="font-medium text-primary underline">
              {t("sharedExpenses.modal.goToInvitations")}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("sharedExpenses.modal.intro")}</p>

            <label className="block text-sm font-medium">
              {t("sharedExpenses.modal.space")}
              <Select
                className="mt-1"
                value={spaceId}
                disabled={isEdit}
                onChange={(e) => {
                  setSpaceId(e.target.value);
                  setCategoryId("");
                }}
              >
                <option value="">{t("sharedExpenses.modal.selectPlaceholder")}</option>
                {sharedSpaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block text-sm font-medium">
              {t("sharedExpenses.modal.category")}
              <Select className="mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">{t("sharedExpenses.modal.noCategory")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}
                    {resolveCategoryName(c, t)}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block text-sm font-medium">
              {t("sharedExpenses.modal.myShare")}
              <Input
                className="mt-1"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="any"
                value={shareInput}
                onChange={(e) => {
                  setShareTouched(true);
                  setShareInput(e.target.value);
                }}
              />
              {!shareValid ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{t("sharedExpenses.modal.shareInvalid")}</p> : null}
            </label>

            {shareValid ? (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p>{t("sharedExpenses.modal.preview", { me, others })}</p>
                <p className="mt-1 text-muted-foreground">
                  {t("sharedExpenses.modal.amounts", {
                    mine: formatEuros(myCents, currency),
                    others: formatEuros(otherCents, currency),
                  })}
                </p>
              </div>
            ) : null}

            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={isSubmitting || !spaceId || !shareValid}>
                {isSubmitting
                  ? t("common.state.saving")
                  : t(isEdit ? "sharedExpenses.modal.submitUpdate" : "sharedExpenses.modal.submitShare")}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("common.actions.cancel")}
              </Button>
              {isEdit ? (
                <Button type="button" variant="destructive" className="ml-auto" onClick={() => setConfirmUnshare(true)}>
                  {t("sharedExpenses.modal.unshare")}
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </Modal>

      <AlertDialog
        open={confirmUnshare}
        onOpenChange={(open) => !open && setConfirmUnshare(false)}
        title={t("sharedExpenses.modal.unshareConfirmTitle")}
        description={t("sharedExpenses.modal.unshareConfirmDescription")}
        onConfirm={onUnshare}
        isConfirming={isUnsharing}
        confirmLabel={t("sharedExpenses.modal.unshare")}
        cancelLabel={t("common.actions.cancel")}
      />
    </>
  );
}
