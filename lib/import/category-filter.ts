// Pure helpers for the import preview: filtering the list by category and
// applying a category to the checked rows (issue 118). Filtering never edits
// rows; applying only touches rows that are both checked and visible.

export const NO_CATEGORY_FILTER = "__none__";

type RowRef = { rowId: string };

export function filterRowsByCategory<T extends RowRef>(
  rows: T[],
  categoryMap: Record<string, string>,
  filter: string,
): T[] {
  if (!filter) return rows;
  if (filter === NO_CATEGORY_FILTER) return rows.filter((r) => !categoryMap[r.rowId]);
  return rows.filter((r) => categoryMap[r.rowId] === filter);
}

export function applyCategoryToSelection(
  categoryMap: Record<string, string>,
  visibleRows: RowRef[],
  checked: Record<string, boolean>,
  categoryId: string,
): Record<string, string> {
  if (!categoryId) return categoryMap;
  const next = { ...categoryMap };
  for (const r of visibleRows) {
    if (checked[r.rowId]) next[r.rowId] = categoryId;
  }
  return next;
}
