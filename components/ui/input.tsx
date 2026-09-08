import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared text/date/number input styling — replaces the near-identical class
 * strings hand-duplicated across `profile-form.tsx`, `invite-form.tsx`, and
 * the transaction filter bar (`rounded-md border border-zinc-300 px-3 py-2
 * dark:border-zinc-600 dark:bg-zinc-800 ...`, each slightly different).
 * Token-based (`border-input`/`bg-background`/`ring-ring`) so it tracks the
 * app's design tokens instead of hardcoded zinc, and shares its focus-ring
 * treatment with `Button`.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-1 text-sm shadow-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  );
}

export { Input };
