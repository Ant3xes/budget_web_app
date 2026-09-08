import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Mail,
  PiggyBank,
  Receipt,
  Settings,
  Target,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { NAV_ITEMS } from "@/lib/constants";

type NavKey = (typeof NAV_ITEMS)[number]["key"];

/**
 * Icon + accent-color mapping for the top nav (issue #42 — sidebar → top
 * navbar). Kept in its own module (rather than inline in top-nav.tsx) so
 * the "one icon / one color per nav key" contract is a single readable
 * table instead of being spread across JSX.
 */
export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  analytics: BarChart3,
  accounts: Wallet,
  transactions: ArrowLeftRight,
  budget: PiggyBank,
  fixedCharges: Receipt,
  goals: Target,
  invitations: Mail,
  settings: Settings,
};

/**
 * Active-pill fill color per nav key, drawn from the shared 8-slot
 * categorical ramp (`--chart-1`..`--chart-8` in app/globals.css) so the
 * navbar reads as part of the same visual system as the charts elsewhere
 * in the app. There are 9 nav items and only 8 chart colors: `settings`
 * re-wraps to `--chart-1`. That reuse is harmless here — dashboard and
 * settings are never the active item at the same time, so there's no
 * wayfinding ambiguity in practice.
 */
export const NAV_ACCENTS: Record<NavKey, string> = {
  dashboard: "var(--chart-1)",
  analytics: "var(--chart-2)",
  accounts: "var(--chart-3)",
  transactions: "var(--chart-4)",
  budget: "var(--chart-5)",
  fixedCharges: "var(--chart-6)",
  goals: "var(--chart-7)",
  invitations: "var(--chart-8)",
  settings: "var(--chart-1)",
};

/**
 * Shared active/inactive class string for a rounded nav pill — both
 * `components/layout/top-nav.tsx` (top-level nav) and
 * `app/(app)/settings/layout.tsx` (settings sub-nav) render the same
 * "colorful pill" visual contract and previously each wrote this string out
 * by hand, needing an edit in both places for any restyle. Mirrors
 * `lib/dashboard/pill-class.ts`'s `pillButtonClass`, which closes the same
 * gap for the dashboard's filter pills. Callers still apply
 * `style={{ backgroundColor: NAV_ACCENTS[key] }}` themselves when `active`
 * (the accent color is per-item, not something this shared class can bake
 * in), and are free to add their own extra classes (icon gap, etc.).
 */
export function navPillClass(active: boolean): string {
  return `rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
    active
      ? "text-white shadow-sm"
      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
  }`;
}
