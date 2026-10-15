// Create a category from the import preview (issue 119). POST /api/categories
// only answers { ok: true }, so the new row is looked up by name + kind in the
// refreshed list. A 409 means an active category already has that name.

export const NEW_CATEGORY_OPTION = "__new__";

export type ImportCategory = {
  id: string;
  name: string;
  kind: string;
  icon: string | null;
  is_default?: boolean;
  translation_key?: string | null;
};

export type CreateCategoryResult =
  | { ok: true; category: ImportCategory; categories: ImportCategory[] }
  | { ok: false; reason: "empty" | "duplicate" | "error"; message?: string };

export async function createCategoryForImport(
  name: string,
  kind: "expense" | "income",
  fetchFn: typeof fetch = fetch,
): Promise<CreateCategoryResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  const res = await fetchFn("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: trimmed, kind }),
  });
  if (res.status === 409) return { ok: false, reason: "duplicate" };
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, reason: "error", message: data.error };
  }

  const listRes = await fetchFn("/api/categories");
  if (!listRes.ok) return { ok: false, reason: "error" };
  const { categories } = (await listRes.json()) as { categories?: ImportCategory[] };
  const list = categories ?? [];
  const created = list.find((c) => c.kind === kind && c.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (!created) return { ok: false, reason: "error" };
  return { ok: true, category: created, categories: list };
}
