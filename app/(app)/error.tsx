"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary of every page under (app) (issue 162): a failed Supabase
 * query throws (see lib/supabase/unwrap.ts) and lands here instead of
 * rendering figures at zero. `retry` (Next 16.3: re-fetches then re-renders the
 * segment; `reset` would only clear the error state and keep the stale failure).
 */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className="mx-auto max-w-md space-y-3 py-16 text-center">
      <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
      <p className="text-sm text-muted-foreground">
        Impossible de charger les données pour le moment. Vos informations n&apos;ont pas été modifiées.
      </p>
      <Button type="button" onClick={() => retry()}>
        Réessayer
      </Button>
    </section>
  );
}
