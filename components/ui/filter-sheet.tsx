"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

interface FilterSheetProps {
  /** i18n key for the trigger button's label (e.g. "common.filters.trigger"). */
  triggerLabelKey: string;
  /** i18n key for the sheet's title (e.g. "common.filters.title"). */
  titleKey: string;
  /** Number of filters currently applied — shown as a badge on the trigger when > 0. */
  activeCount?: number;
  className?: string;
  children: ReactNode;
}

/**
 * Mobile entry point for a page's filters: a "Filtres" button that opens the
 * shared bottom-sheet `Modal` (already used for the mobile "Plus" nav menu)
 * with the filter controls stacked full-width instead of wrapping into a
 * cramped row. Callers keep their existing filter components unchanged and
 * render them twice — once in their normal desktop layout, once as this
 * sheet's children — visibility between the two is controlled by the
 * caller's own `md:hidden`/`hidden md:*` wrappers, not by this component.
 */
export function FilterSheet({ triggerLabelKey, titleKey, activeCount = 0, className, children }: FilterSheetProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className={cn("gap-2", className)}>
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        {t(triggerLabelKey)}
        {activeCount > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background">
            {activeCount}
          </span>
        )}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={t(titleKey)}>
        <div className="flex flex-col gap-4">{children}</div>
      </Modal>
    </>
  );
}
