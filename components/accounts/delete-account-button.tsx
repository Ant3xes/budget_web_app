"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteAccountButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <button
      type="button"
      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50"
      disabled={isDeleting}
      onClick={async () => {
        setIsDeleting(true);
        await fetch("/api/accounts", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: accountId }),
        });
        setIsDeleting(false);
        router.refresh();
      }}
    >
      Delete
    </button>
  );
}
