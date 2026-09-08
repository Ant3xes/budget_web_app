"use client";

import * as React from "react";
import { Menu as MenuPrimitive } from "@base-ui/react/menu";

import { cn } from "@/lib/utils";

/**
 * Floating action menu — replaces the 3 hand-rolled popovers duplicated
 * across the app (transactions' type-picker, fixed-charges' row menu,
 * account-detail's kebab menu), each with its own radius/shadow and its own
 * ad-hoc open-state/click-outside handling. Built on `@base-ui/react/menu`
 * (already a dependency, same family as `Button`/`AlertDialog`), which
 * handles positioning, keyboard nav, and outside-click/escape dismissal for
 * free — the 3 callers above previously each reimplemented outside-click by
 * hand.
 */
function DropdownMenu(props: React.ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root {...props} />;
}

function DropdownMenuTrigger(props: React.ComponentProps<typeof MenuPrimitive.Trigger>) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Popup> &
  Pick<React.ComponentProps<typeof MenuPrimitive.Positioner>, "align" | "sideOffset" | "side">) {
  const { side, ...popupProps } = props;
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner align={align} side={side} sideOffset={sideOffset} className="z-50 outline-none">
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "min-w-[10rem] overflow-hidden rounded-2xl bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
            "origin-[var(--transform-origin)] transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            className
          )}
          {...popupProps}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Item> & { variant?: "default" | "destructive" }) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-muted",
        variant === "destructive" && "text-destructive data-[highlighted]:bg-destructive/10",
        className
      )}
      {...props}
    />
  );
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
