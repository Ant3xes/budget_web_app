"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary (issue 162): replaces the root layout when it fails,
 * so it renders its own <html>/<body> and cannot rely on app styles or
 * components.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "4rem 1rem" }}>
        <div role="alert">
          <h1 style={{ fontSize: "1.25rem" }}>Une erreur est survenue</h1>
          <p>L&apos;application a rencontré un problème inattendu.</p>
          <button type="button" onClick={() => retry()} style={{ padding: "0.5rem 1rem", cursor: "pointer" }}>
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
