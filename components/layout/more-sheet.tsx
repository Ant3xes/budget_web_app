"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { LogoutButtonLabel } from "@/components/layout/logout-button-label";
import { isNavActive, type NavItem } from "@/components/layout/nav-utils";
import { LocaleToggle } from "@/components/locale-toggle";
import { useLocale } from "@/components/locale-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { NAV_ACCENTS, NAV_ICONS } from "@/lib/nav-icons";

/** Sheet « Plus » de la bottom-nav : entrées secondaires en tuiles, préférences, compte. */
export function MoreSheet({
  open,
  onOpenChange,
  userEmail,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  items: readonly NavItem[];
}) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("nav.more")}>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = NAV_ICONS[item.key];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onOpenChange(false)}
              aria-current={active ? "page" : undefined}
              className="flex min-h-16 items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-sm font-medium ring-1 ring-foreground/10 transition-colors active:bg-muted"
            >
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white"
                style={{ backgroundColor: NAV_ACCENTS[item.key] }}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className={active ? "font-semibold" : ""}>{t(`nav.items.${item.key}`)}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="min-w-0 truncate text-sm text-muted-foreground" title={userEmail}>
          {userEmail}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </div>
      <form action={logout} className="mt-4">
        <Button type="submit" variant="outline" className="w-full rounded-full">
          <LogoutButtonLabel />
        </Button>
      </form>
    </Modal>
  );
}
