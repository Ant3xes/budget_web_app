import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Native `<select>`, styled to match `Input`/`Button` — replaces the
 * hand-rolled `rounded-md border ... + manually positioned ChevronDown`
 * pattern duplicated across the transaction filter bar. Stays a native
 * select (not a `@base-ui/react/select` compound component) deliberately:
 * every current caller is a simple single-value filter/form field with no
 * need for custom option rendering, so the native element keeps native
 * keyboard/mobile behavior for free.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "flex h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-background px-2.5 py-1 pr-7 text-sm shadow-sm outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { Select };
