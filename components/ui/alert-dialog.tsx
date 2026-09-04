"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirm action (styled red) — the only variant used so far (delete confirmations). */
  onConfirm: () => void;
  isConfirming?: boolean;
}

/**
 * Confirmation dialog for destructive actions — replaces the native
 * `confirm()` used across budget/categories/import-rules delete buttons
 * (plan §5). Deliberately a single simple controlled component (not a full
 * compound-component API) since every current caller is the same shape: a
 * yes/no destructive confirmation.
 */
export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Supprimer",
  cancelLabel = "Annuler",
  onConfirm,
  isConfirming = false,
}: AlertDialogProps) {
  // Mount/unmount ourselves via plain React conditional rendering rather
  // than leaving it to AlertDialogPrimitive.Root's own open/close + exit-
  // animation coordination: with `open={open}` passed straight through,
  // closing left the popup stuck in the DOM (`data-ending-style` set, never
  // cleared) even with no CSS transition at all for it to wait on. Always
  // mounting Root with `open` hardcoded to `true` and instead not rendering
  // this component at all when closed sidesteps that entirely.
  if (!open) return null;

  return (
    <AlertDialogPrimitive.Root open onOpenChange={(next) => !next && onOpenChange(false)}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialogPrimitive.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-200 bg-white p-5 shadow-lg",
            "dark:border-zinc-700 dark:bg-zinc-900",
          )}
        >
          <AlertDialogPrimitive.Title className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </AlertDialogPrimitive.Title>
          {description && (
            <AlertDialogPrimitive.Description className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </AlertDialogPrimitive.Description>
          )}
          <div className="mt-4 flex justify-end gap-2">
            {/* A plain onClick rather than AlertDialogPrimitive.Close's
                `render` merge — that merge didn't reliably wire up the
                close-on-click behavior onto a custom Button element. */}
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button variant="destructive" size="sm" onClick={onConfirm} disabled={isConfirming}>
              {isConfirming ? "Suppression…" : confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
