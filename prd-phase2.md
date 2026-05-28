## Problem Statement

Après la Phase 1 (auth, gestion des comptes, sidebar), l'application Budget & Comptes ne permettait pas de saisir ou visualiser des transactions. L'utilisateur ne pouvait pas :

- Créer, modifier ou supprimer des dépenses et des revenus
- Organiser ses transactions par catégorie personnalisable (avec icône et couleur)
- Gérer des virements entre ses propres comptes
- Importer ses relevés bancaires N26 (CSV) et BNP (XLS) sans saisie manuelle

L'absence de ces fonctionnalités rendait l'application inutilisable en conditions réelles.

## Solution

Implémenter le cœur transactionnel de l'application en quatre axes :

1. **Catégories** : CRUD complet avec icône (emoji) et couleur, groupées par type (dépense / revenu / virement), avec 17 catégories par défaut créées automatiquement à l'inscription.
2. **Transactions** : saisie manuelle des dépenses et des revenus via une modale, liste filtrée et paginée par compte, catégorie, période et texte libre.
3. **Virements** : création d'un virement entre deux comptes de l'utilisateur, générant automatiquement une paire débit/crédit liée.
4. **Import** : wizard en 3 étapes (fichier → prévisualisation → confirmation) reconnaissant les formats N26 (CSV) et BNP (XLS/XLSX), avec déduplication par hash SHA-256 et catégorisation automatique par règles mots-clés.

## User Stories

### Catégories

1. As a user, I want to see all my expense and income categories grouped by type on the Settings page, so that I have a clear overview.
2. As a user, I want to create a new category with a name, type, emoji icon, and color, so that my transactions are well organized.
3. As a user, I want to edit an existing category's name, icon, or color inline, so that I can correct mistakes without leaving the page.
4. As a user, I want to soft-delete a category, so that it disappears from lists without corrupting historical transaction data.
5. As a user, I want 17 default categories (12 expense, 4 income, 1 transfer) to be automatically created when I sign up, so that I can start categorizing immediately.
6. As a user, I want categories to display their icon and color as a visual indicator in all dropdowns and lists, so that I can identify them at a glance.

### Transactions — Dépenses & Revenus

7. As a user, I want to see a paginated list of my expenses (25 per page), so that I can browse my transaction history without the page becoming unmanageable.
8. As a user, I want to filter my transactions by account, category, date range, and free-text search, so that I can quickly find a specific transaction.
9. As a user, I want to add a new expense or income from a modal form, specifying account, amount, date, description, category, and optional notes, so that I can record transactions quickly.
10. As a user, I want the amount field to accept decimal input (e.g. "45.30") and have it stored as integer cents (4530) automatically, so that I never deal with floating-point precision issues.
11. As a user, I want expense amounts to be stored as negative cents and income amounts as positive cents, so that balance calculations remain consistent.
12. As a user, I want to edit an existing transaction from the list, so that I can fix typos or re-categorize.
13. As a user, I want to soft-delete a transaction (setting deleted_at), so that the data is never permanently lost.
14. As a user, I want the system to prevent editing or deleting a transaction that belongs to a transfer pair, so that transfer integrity is preserved.
15. As a user, I want the category dropdown in the transaction form to only show categories matching the transaction kind (expense or income), so that I cannot mismatch types.
16. As a user, I want the category and account selects in the transaction form to be pre-populated from the API, so that I can pick from real data.

### Virements (Transfers)

17. As a user, I want to create a transfer between two of my own accounts (source and destination), so that internal money movements are tracked accurately.
18. As a user, I want the transfer creation to atomically produce a debit transaction on the source account and a credit transaction on the destination account, linked by a shared transfer_id, so that my balances stay consistent.
19. As a user, I want the system to reject a transfer where source and destination are the same account, so that nonsensical transfers are prevented.
20. As a user, I want to see a list of my transfers with date, source account, destination account, description, and amount, so that I can review my internal movements.
21. As a user, I want to edit a transfer's amount, date, or description, so that I can correct mistakes.
22. As a user, I want editing a transfer to update both the debit and credit transactions simultaneously, so that the two sides stay in sync.
23. As a user, I want to delete a transfer, soft-deleting both the debit and credit transactions in one operation, so that the pair is always consistent.
24. As a user, I want transfer transactions to be excluded from the expenses and incomes lists, so that they don't pollute those views.

### Import CSV/XLS

25. As a user, I want to upload a N26 CSV file and have its transactions parsed automatically, so that I avoid manual data entry.
26. As a user, I want to upload a BNP XLS or XLSX file and have its transactions parsed automatically, so that I can import from both my banks.
27. As a user, I want the import wizard to detect the file format automatically from its headers, so that I don't have to specify it manually.
28. As a user, I want to see a preview of the parsed transactions before confirming the import, so that I can review and adjust before anything is saved.
29. As a user, I want each preview row to show a suggested category based on my import rules, so that the import requires minimal manual re-categorization.
30. As a user, I want to change the category of any row in the preview, so that I can override the automatic suggestion.
31. As a user, I want rows that are already present in the database (detected by SHA-256 hash of date + description + amount) to be flagged as duplicates and excluded from selection, so that I never import the same transaction twice.
32. As a user, I want to select or deselect individual rows before confirming, so that I can skip transactions I don't want to import.
33. As a user, I want bulk "select all / deselect all" buttons in the preview step, so that I can manage large imports quickly.
34. As a user, I want to choose the destination account at the start of the import wizard, so that all imported transactions are assigned to the correct account.
35. As a user, I want the import to filter preview rows by kind (expense or income) according to which page I launched the import from, so that only relevant rows are shown.
36. As a user, I want a maximum of 500 transactions per import batch, so that the operation stays within reasonable limits.
37. As a user, I want a confirmation screen after the import with the count of imported transactions, so that I know the operation succeeded.

### Settings — Règles d'import

38. As a user, I want to define keyword-based rules that automatically assign a category to imported transactions matching a given description pattern, so that recurring payees are categorized without manual effort.

## Implementation Decisions

### Category seeding

A `seed_default_categories(user_id)` SQL function is called by the existing `handle_new_user` trigger on signup. The 17 default categories are: 12 expense (Alimentation 🛒, Logement 🏠, Transport 🚗, Santé 🏥, Loisirs 🎮, Vêtements 👗, Restaurants 🍽️, Voyages ✈️, Abonnements 📱, Education 📚, Cadeaux 🎁, Banque & Frais 🏦), 4 income (Salaire 💰, Freelance 💻, Remboursement 🔄, Autre revenu ➕), 1 transfer (Virement interne 🔁).

### Categories API

- `GET /api/categories` — returns all non-deleted categories for the authenticated user, sorted by kind then name.
- `POST /api/categories` — creates a new category. Validated with Zod.
- `PATCH /api/categories/:id` — partial update (name, icon, color).
- `DELETE /api/categories/:id` — soft delete via `deleted_at`.

### Transactions API

- `GET /api/transactions` — supports query params: `kind`, `account_id`, `category_id`, `date_from`, `date_to`, `q` (full-text on description/notes), `page`, `per_page` (default 25, max 100). Returns `{ transactions, total }`. Joins `accounts(name)` and `categories(name, color, icon)` for display.
- `POST /api/transactions` — validates with Zod. `kind` is restricted to `expense | income` (never `transfer_debit | transfer_credit`). Amounts for expenses must be negative cents; incomes must be positive cents.
- `PATCH /api/transactions/:id` — partial update. Returns 400 if the transaction has a `transfer_id` (belongs to a transfer pair).
- `DELETE /api/transactions/:id` — soft delete. Also blocked if `transfer_id` is set.

### Transfers API

- `GET /api/transfers` — returns debit-side transactions with their corresponding credit transaction looked up via `transfer_id`. Returns `{ transfers, total }` with pagination.
- `POST /api/transfers` — validates that `from_account_id !== to_account_id`. Creates the debit (`kind: transfer_debit`, negative `amount_cents`) and credit (`kind: transfer_credit`, positive `amount_cents`) in the same request, sharing a `crypto.randomUUID()` as `transfer_id`.
- `PATCH /api/transfers/:transferId` — the route parameter is the shared `transfer_id` UUID. Updates both sides: description/date on both; when amount changes, sets debit to `-amount_cents` and credit to `+amount_cents`.
- `DELETE /api/transfers/:transferId` — soft-deletes both transactions via `.eq("transfer_id", transferId)`.

### Import pipeline

Three stages:

1. **Parse** (`POST /api/import/preview`): accepts `multipart/form-data`. Auto-detects format from file headers (N26: presence of "booking date" + "amount (eur)"; BNP: presence of "date operation" in row 1). Parses to `ParsedTransaction[]` (date YYYY-MM-DD, description, amount_cents). Computes SHA-256 hash per row (`date|description|amount_cents`). Queries DB for existing hashes to flag duplicates. Applies `csv_import_rules` for category suggestion. Returns `{ preview: [...] }` with `is_duplicate` and `suggested_category_id` per row.

2. **Confirm** (`POST /api/import/confirm`): accepts `{ account_id, transactions[] }` (max 500). Inserts all rows with `is_imported: true` and `raw_import_data: { hash }` for future deduplication.

3. **Deduplication module** (`lib/import/deduplicate`): pure function `buildHash(tx) → string` (SHA-256) and async `findExistingHashes(supabase, userId, hashes[]) → Set<string>`. This is the deepest module — it has no UI dependencies and a simple, stable interface.

### BNP XLS parsing

Row 0 is the account header (ignored). Row 1 contains column headers. Data starts at row 2. Columns searched case-insensitively: `date operation`, `libelle` / `intitulé`, `montant`. Dates normalized from `DD-MM-YYYY` or `DD/MM/YYYY` to `YYYY-MM-DD`. Uses SheetJS (`xlsx` package, already installed).

### N26 CSV parsing

Standard RFC 4180 CSV. Row 0 = headers. Mapping: `Booking Date` → `date`, `Partner Name` → `description`, `Amount (EUR)` → `amount_cents` (float × 100, rounded). Minimal custom parser included to avoid external CSV dependencies.

### Import rules (keyword matching)

`buildRuleMatcher(supabase, userId)` loads `csv_import_rules` for the user and returns a sync matcher function `(description, kind) → category_id | null`. Case-insensitive keyword matching. Applied during the preview step.

### Form pattern

All forms use React Hook Form + `zodResolver`. Fields with nullable UUID values (e.g. `category_id`) use `z.string().optional()` without `.transform()` — transformations are performed in the `onSubmit` handler instead. This avoids a TypeScript `Resolver<>` type error that arises when input and output types diverge.

### Settings navigation

A settings sub-layout wraps `/settings/*` pages with a secondary nav: Categories, Règles d'import, Profil.

## Testing Decisions

### What makes a good test

Tests should verify observable behavior — what the API returns, what ends up in the database, what the user sees — not internal implementation details such as which Supabase method was called or what intermediate state was held.

### Modules to test

- **`buildHash()`** in the deduplication module: pure function, deterministic, no side effects. Test that identical `(date, description, amount_cents)` tuples produce the same hash, and different tuples produce different hashes.
- **`findExistingHashes()`**: integration test with a real (local) Supabase instance — insert known transactions with `is_imported: true`, verify the function correctly identifies them as duplicates.
- **`parseN26Csv()`**: unit test with fixture CSV strings. Verify correct extraction of date, description, amount for positive and negative amounts, and correct handling of quoted fields.
- **`parseBnpXls()`**: unit test with a fixture XLS buffer (created programmatically with SheetJS). Verify date normalization (DD-MM-YYYY → YYYY-MM-DD) and amount parsing.
- **`detectFormat()`**: unit test with header arrays — verify N26 and BNP detection, and rejection of unknown formats.
- **Zod schemas for the transactions API**: test the `transactionSchema` and `querySchema` directly — verify validation passes for valid input and fails with the correct error for invalid input (e.g. non-integer amount, invalid UUID).
- **Transfer atomicity**: integration test — verify that a successful `POST /api/transfers` creates exactly two transactions in the DB with opposite signs and the same `transfer_id`.

### Prior art

No tests exist in the codebase yet. These would be the first. Recommended setup: Vitest for unit tests, with a Supabase local instance for integration tests.

## Out of Scope

- Editing the source or destination account of an existing transfer (only amount, date, and description are editable).
- Import from formats other than N26 CSV and BNP XLS/XLSX.
- Automatic detection of the source account from the file content.
- Real-time duplicate detection as the user types in the manual transaction form.
- Transaction tagging / multi-category split.
- Recurring transaction scheduling from the transactions interface (covered separately by Fixed Charges).
- Email notifications on import.

## Further Notes

- The `transactions.kind` column uses `'expense' | 'income' | 'transfer_debit' | 'transfer_credit'` — never `'type'`.
- The `transfer_id` column on `transactions` is a plain `UUID` (not a foreign key) shared between both legs of a transfer. This is intentional — there is no separate `transfers` table.
- The deduplication hash is stored in `transactions.raw_import_data->>'hash'` (JSONB). A future optimization would be to add a generated column `import_hash TEXT GENERATED ALWAYS AS (raw_import_data->>'hash') STORED` with a unique index for O(1) lookup instead of the current client-side filtering.
- N26 amounts are signed floats in the source CSV; they must be multiplied by 100 and rounded to integer before storage. The sign is preserved: negative = expense, positive = income.
