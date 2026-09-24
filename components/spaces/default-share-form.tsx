"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DefaultShareForm({
  spaceId,
  initialPercent,
  canEdit,
}: {
  spaceId: string;
  initialPercent: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [value, setValue] = useState(String(initialPercent));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const percent = Number(value);
    if (value.trim() === "" || !Number.isInteger(percent) || percent < 0 || percent > 100) {
      setError(t("sharedExpenses.defaultSplit.invalid"));
      return;
    }

    setSubmitting(true);
    const response = await fetch(`/api/spaces/${spaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ default_share_percent: percent }),
    });
    setSubmitting(false);

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? t("sharedExpenses.defaultSplit.error"));
      return;
    }

    setSaved(true);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium">
        {t("sharedExpenses.defaultSplit.label")}
        <Input
          className="mt-1"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={value}
          readOnly={!canEdit}
          disabled={!canEdit}
          onChange={(event) => {
            setSaved(false);
            setValue(event.target.value);
          }}
        />
      </label>
      {!canEdit ? (
        <p className="text-sm text-muted-foreground">{t("sharedExpenses.defaultSplit.readOnly")}</p>
      ) : (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {t("sharedExpenses.defaultSplit.save")}
          </Button>
          {saved ? <span className="text-sm text-muted-foreground">{t("sharedExpenses.defaultSplit.saved")}</span> : null}
        </div>
      )}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
