"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateSpaceForm() {
  const router = useRouter();
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t("invitations.create.nameRequired"));
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSubmitting(false);

    if (!response.ok) {
      setError(t("invitations.create.error"));
      return;
    }

    setName("");
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium">
        {t("invitations.create.nameLabel")}
        <Input
          className="mt-1"
          value={name}
          maxLength={80}
          placeholder={t("invitations.create.namePlaceholder")}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={submitting}>
        {t("invitations.create.submit")}
      </Button>
    </form>
  );
}
