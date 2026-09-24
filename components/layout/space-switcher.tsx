"use client";

import { Check, ChevronsUpDown, Settings2, User, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { useLocale } from "@/components/locale-provider";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { SpaceSummary } from "@/lib/spaces/context";
import { cn } from "@/lib/utils";

function SpaceIcon({ kind, className }: { kind: SpaceSummary["kind"]; className?: string }) {
  const Icon = kind === "personal" ? User : Users;
  return <Icon className={className} aria-hidden="true" />;
}

/**
 * Switches the space the whole app is scoped to (personal space or a shared
 * one). The choice is stored in a cookie by `POST /api/spaces/active`; the
 * refresh then re-renders every server component against the new space.
 * `collapsed` shows just the icon (desktop rail); `compact` is the mobile
 * header variant.
 */
export function SpaceSwitcher({
  spaces,
  activeSpaceId,
  collapsed = false,
  compact = false,
}: {
  spaces: SpaceSummary[];
  activeSpaceId: string;
  collapsed?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  const label = (space: SpaceSummary) => (space.kind === "personal" ? t("nav.spaces.personal") : space.name);
  const active = spaces.find((space) => space.id === activeSpaceId) ?? spaces[0];
  if (!active) {
    return null;
  }

  const select = async (spaceId: string) => {
    if (spaceId === activeSpaceId) {
      return;
    }
    const response = await fetch("/api/spaces/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spaceId }),
    });
    if (response.ok) {
      startTransition(() => router.refresh());
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("nav.spaces.switcher", { space: label(active) })}
        title={label(active)}
        disabled={pending}
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
          collapsed ? "w-9 justify-center" : compact ? "max-w-44 px-2" : "w-full px-2.5",
        )}
      >
        <SpaceIcon kind={active.kind} className="size-[18px] shrink-0 text-muted-foreground" />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-left font-medium">{label(active)}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className="w-60">
        <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{t("nav.spaces.heading")}</p>
        {spaces.map((space) => (
          <DropdownMenuItem key={space.id} onClick={() => void select(space.id)}>
            <SpaceIcon kind={space.kind} className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{label(space)}</span>
            {space.id === active.id ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
          </DropdownMenuItem>
        ))}
        <div className="my-1 h-px bg-border" />
        <DropdownMenuItem render={<Link href="/invitations" />}>
          <Settings2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>{t("nav.spaces.manage")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
