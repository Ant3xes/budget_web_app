"use client";

import { useCallback, useEffect, useState } from "react";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type PreviewRow = { id: string; date: string; description: string; amount_cents: number };

type Preview = {
  since: string;
  since_default: string;
  target_space: { id: string; name: string };
  payer_percent: number;
  rows: PreviewRow[];
  total_cents: number;
  truncated: boolean;
};

const formatAmount = (cents: number) => `${(Math.abs(cents) / 100).toFixed(2)} €`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Retroactive sharing of an import rule: previews the already-imported
 * expenses the rule would share (read-only), lets the user uncheck lines and
 * change the start date, then shares the kept ones in one atomic call.
 */
export function ApplyRuleShareModal({
  ruleId,
  keyword,
  onDone,
  onClose,
}: {
  ruleId: string;
  keyword: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [since, setSince] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharedCount, setSharedCount] = useState<number | null>(null);

  const applyPreview = useCallback((body: Preview) => {
    setPreview(body);
    setSince(body.since);
    setUnchecked(new Set());
    setIsLoading(false);
  }, []);

  const fetchPreview = useCallback(
    async (from: string | null): Promise<Preview> => {
      const query = from ? `?since=${encodeURIComponent(from)}` : "";
      const response = await fetch(`/api/import-rules/${ruleId}/apply-share${query}`);
      const body = (await response.json()) as Preview & { error?: string };
      if (!response.ok) throw new Error(body.error ?? t("importRules.apply.loadError"));
      return body;
    },
    [ruleId, t],
  );

  const failLoading = useCallback(
    (e: unknown) => {
      setError(e instanceof Error ? e.message : t("importRules.apply.loadError"));
      setIsLoading(false);
    },
    [t],
  );

  // Initial state is already "loading, no error": state is only set in the callbacks.
  useEffect(() => {
    fetchPreview(null).then(applyPreview, failLoading);
  }, [fetchPreview, applyPreview, failLoading]);

  const reload = (from: string) => {
    setIsLoading(true);
    setError(null);
    fetchPreview(from).then(applyPreview, failLoading);
  };

  const kept = preview?.rows.filter((row) => !unchecked.has(row.id)) ?? [];
  const keptTotal = kept.reduce((sum, row) => sum + Math.abs(row.amount_cents), 0);

  const toggle = (id: string) =>
    setUnchecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleShare = async () => {
    if (!since || kept.length === 0) return;
    setIsSharing(true);
    setError(null);
    try {
      const response = await fetch(`/api/import-rules/${ruleId}/apply-share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ since, transaction_ids: kept.map((row) => row.id) }),
      });
      const body = (await response.json()) as { shared?: number; error?: string };
      if (!response.ok) throw new Error(body.error ?? t("importRules.apply.shareError"));
      setSharedCount(body.shared ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("importRules.apply.shareError"));
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={t("importRules.apply.title", { keyword })}
      description={t("importRules.apply.description")}
      className="md:max-w-2xl"
      closeLabel={t("common.actions.close")}
    >
      {sharedCount !== null ? (
        <div className="space-y-4">
          <p className="text-sm">{t("importRules.apply.done", { count: String(sharedCount) })}</p>
          <div className="flex justify-end">
            <Button onClick={onDone}>{t("common.actions.close")}</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">{t("importRules.apply.since")}</span>
            <input
              type="date"
              value={since ?? ""}
              onChange={(event) => event.target.value && reload(event.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
              disabled={isLoading || isSharing}
            />
          </label>

          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            {t("importRules.apply.warning")}
          </p>

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          {isLoading ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("common.state.loading")}</p>
          ) : preview && preview.rows.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("importRules.apply.empty")}</p>
          ) : preview ? (
            <>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("importRules.apply.target", {
                  space: preview.target_space.name,
                  percent: String(preview.payer_percent),
                })}
              </p>
              <div className="max-h-72 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={!unchecked.has(row.id)}
                            onChange={() => toggle(row.id)}
                            aria-label={row.description}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">{formatDate(row.date)}</td>
                        <td className="max-w-56 truncate px-3 py-2">{row.description}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{formatAmount(row.amount_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.truncated ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("importRules.apply.truncated")}</p>
              ) : null}
              <p className="text-sm font-medium">
                {t("importRules.apply.total", { count: String(kept.length), amount: formatAmount(keptTotal) })}
              </p>
            </>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSharing}>
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={() => void handleShare()} disabled={isLoading || isSharing || kept.length === 0}>
              {isSharing ? t("common.state.saving") : t("importRules.apply.confirm", { count: String(kept.length) })}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
