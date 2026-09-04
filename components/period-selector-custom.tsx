"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { currentMonth, periodToParam, type Period } from "@/lib/dates/period";

interface PeriodSelectorCustomProps {
  current: Period;
  basePath: string;
}

/**
 * "Personnalisé" entry of `PeriodSelector` — the one option that needs real
 * user interaction (picking two arbitrary months) rather than a plain link,
 * so it's split into its own client component instead of making the whole
 * (Server Component) `period-selector.tsx` a client component. Encodes the
 * chosen range as `?period=YYYY-MM:YYYY-MM` (see `parsePeriodParam`), so it
 * still fits the existing single `?period=` query key.
 */
export function PeriodSelectorCustom({ current, basePath }: PeriodSelectorCustomProps) {
  const router = useRouter();
  const isActive = current.type === "range";
  const defaultMonth = currentMonth();
  const [from, setFrom] = useState(current.type === "range" ? current.from : defaultMonth);
  const [to, setTo] = useState(current.type === "range" ? current.to : defaultMonth);

  // Resync when `current` changes from elsewhere (e.g. clicking a preset
  // `<Link>` after applying a custom range) — this component's own state
  // isn't remounted by that navigation, since it keeps the same position in
  // the tree, so without this the inputs would keep showing a stale range
  // even though it's no longer the active period. Adjusted during render
  // (React's documented pattern for syncing state from props) rather than
  // in an effect, comparing the *encoded* period so an equal-but-new
  // `current` object from an unrelated re-render doesn't reset mid-edit.
  const [prevParam, setPrevParam] = useState(periodToParam(current));
  const currentParam = periodToParam(current);
  if (currentParam !== prevParam) {
    setPrevParam(currentParam);
    setFrom(current.type === "range" ? current.from : defaultMonth);
    setTo(current.type === "range" ? current.to : defaultMonth);
  }

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors ${
        isActive
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-600 dark:text-zinc-400"
      }`}
    >
      <span className="whitespace-nowrap">Personnalisé</span>
      <input
        type="month"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        aria-label="Mois de début"
        className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      />
      <span aria-hidden>–</span>
      <input
        type="month"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        aria-label="Mois de fin"
        className="rounded border border-zinc-300 bg-white px-1 py-0.5 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
      />
      <button
        type="button"
        onClick={() => router.push(`${basePath}?period=${from}:${to}`)}
        className="rounded px-1.5 py-0.5 text-xs font-medium underline-offset-2 hover:underline"
      >
        Appliquer
      </button>
    </div>
  );
}
