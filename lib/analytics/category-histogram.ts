export interface CategoryHistogramEntry {
  /** Stable key (grouped category name — `computeExpenseByCategory` groups by name, so it is unique). */
  id: string;
  label: string;
  value: number; // cents (positive)
  color: string;
}

/** Sorted by amount desc (ties by label), independent of the input order. */
export function sortCategoryHistogram(entries: CategoryHistogramEntry[]): CategoryHistogramEntry[] {
  return [...entries].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** Entries still shown once the toggled-off ids are removed, sorted by amount desc. */
export function visibleCategoryHistogram(entries: CategoryHistogramEntry[], hiddenIds: ReadonlySet<string>): CategoryHistogramEntry[] {
  return sortCategoryHistogram(entries.filter((e) => !hiddenIds.has(e.id)));
}

/** Returns a new set with `id` added when absent, removed when present. */
export function toggleHiddenId(hiddenIds: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(hiddenIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
