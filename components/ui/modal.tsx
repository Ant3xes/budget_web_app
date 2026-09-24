"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Largeur max sur desktop (ex. `md:max-w-md`, `md:max-w-3xl`). Défaut : `md:max-w-md`. */
  className?: string;
  closeLabel?: string;
}

/**
 * Dialog partagé : bottom-sheet sous `md` (ancré en bas, coins hauts arrondis,
 * hauteur max 90dvh, contenu scrollable, safe-area iOS), carte centrée à partir
 * de `md`. Focus-trap + Escape via base-ui. Même stratégie de montage que
 * `AlertDialog` : rendu conditionnel plutôt que `open` piloté par la primitive.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  closeLabel = "Fermer",
}: ModalProps) {
  if (!open) return null;

  return (
    <DialogPrimitive.Root open onOpenChange={(next) => !next && onOpenChange(false)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed z-50 flex w-full flex-col bg-card text-card-foreground shadow-lg ring-1 ring-foreground/10 outline-none",
            "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]",
            "md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[85dvh] md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:pb-0",
            className,
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30 md:hidden" aria-hidden="true" />
          <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 pb-2">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label={closeLabel}
              className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted md:size-8"
            >
              <XIcon className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-5">{children}</div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
