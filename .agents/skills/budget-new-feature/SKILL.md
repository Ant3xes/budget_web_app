---
name: budget-new-feature
description: Scaffold a complete new feature for the budget_web_app covering all layers: DB migration, API route, Server Component page, Client Component list + modal, sidebar link, tests. Use when user asks to add a new module, page, or feature to the budget app.
---

# budget-new-feature

## Scaffolding order (each step depends on the previous)

1. **Migration** → follow `budget-db-migration` skill → `supabase/migrations/`
2. **API route** → follow `budget-add-api-route` skill → `app/api/[resource]/route.ts`
3. **Server Component page** → `app/(app)/[resource]/page.tsx`
4. **Client Components** → `components/[resource]/[resource]-list.tsx` + `[resource]-modal.tsx`
5. **Sidebar link** → `components/layout/sidebar.tsx`
6. **Tests** → follow `budget-write-tests` skill

## Server Component page

- Import `createServerSupabaseClient` from `@/lib/supabase/server`
- Auth guard is in `app/(app)/layout.tsx` — no need to re-check in the page
- `const { month } = await searchParams` (Promise in Next.js 16)
- Pass pre-fetched data as props to the Client Component

## Client Component — list pattern

Reference: `components/fixed-charges/fixed-charges-list.tsx`, `components/budget/budget-list.tsx`

```ts
'use client'
// State: items, isModalOpen, editingItem
// loadData(): fetch('/api/[resource]') → setState
// useEffect(() => { void loadData() }, [dependency])
// Month nav: useState + window.history.replaceState (no Next.js router)
```

## Client Component — modal pattern

Reference: `components/budget/budget-modal.tsx`

```ts
'use client'
// useForm + zodResolver
// Amount input: type="text", regex /^\d+([.,]\d{1,2})?$/
// To cents:   Math.round(parseFloat(v.replace(',', '.')) * 100)
// From cents: (amount_cents / 100).toFixed(2)
// Supports create (POST) + edit (PATCH) modes via presence of id prop
// Callbacks: onSuccess() + onClose()
```

## Key rules

- `kind` on transactions (not `type`): `'expense' | 'income' | 'transfer_debit' | 'transfer_credit'`
- Dates: store UTC, display with `timeZone: 'UTC'` for date-only values (avoids TZ shift)
- Supabase join results: cast `as unknown as Type | null`
- All amounts: INTEGER cents throughout the stack
