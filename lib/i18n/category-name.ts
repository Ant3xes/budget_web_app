/**
 * Resolves a category's display name: a default (seeded) category with a
 * `translation_key` follows the app's locale via `t()`; a user-created
 * category (or a default category seeded before the
 * `is_default`/`translation_key` migration) always shows its stored `name`
 * verbatim, never auto-translated.
 */
export function resolveCategoryName(
  category: { name: string; is_default?: boolean | null; translation_key?: string | null },
  t: (key: string) => string,
): string {
  if (category.is_default && category.translation_key) {
    return t(`categories.defaults.${category.translation_key}`);
  }
  return category.name;
}
