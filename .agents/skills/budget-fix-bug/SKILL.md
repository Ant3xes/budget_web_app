---
name: budget-fix-bug
description: Diagnose and fix bugs in the budget_web_app by checking the most common project-specific pitfalls: Next.js 16 async params/searchParams, Supabase join type casting, amounts in cents, Server/Client Supabase client boundary, kind vs type on transactions, missing soft delete filter. Use when user reports a bug, error, or unexpected behavior in the budget app.
---

# budget-fix-bug

## Pitfalls checklist — run through before anything else

### 1. Next.js 16 — params & searchParams are Promises

```ts
// ❌ const { id } = params;
const { id } = await params;           // ✅ Server Component / route handler
const { month } = await searchParams;  // ✅ Server Component
```

### 2. Supabase join type casting

Joins appear as arrays in TS types but are single objects at runtime.

```ts
// ❌ Type error: 'Category[]' not assignable to 'Category | null'
// ✅ Cast:
const cat = tx.categories as unknown as { name: string; color: string } | null;
```

### 3. Amount arithmetic — INTEGER cents only

```ts
// ❌ parseFloat(input) * 100  →  floating-point drift
// ✅ Math.round(parseFloat(input.replace(',', '.')) * 100)

// Expenses are stored as NEGATIVE cents
// balance = initial_balance_cents + SUM(amount_cents)
```

### 4. Server/Client Supabase client boundary

- `createServerSupabaseClient` → Server Components and API routes only
- `createBrowserClient` → `'use client'` components only
- Mixing them → "Cannot call server-only code from a Client Component"

### 5. Transaction field: `kind` not `type`

Values: `'expense' | 'income' | 'transfer_debit' | 'transfer_credit'`

### 6. Always filter soft-deleted rows

Every Supabase read must include `.is("deleted_at", null)` unless intentionally querying deleted rows.

## Debugging flow

1. Browser Network tab → look for 4xx/5xx on API routes
2. Next.js terminal → server-side errors and stack traces
3. `npm run test` → catch unit regressions
4. Add `console.log(JSON.stringify(result, null, 2))` in the API route to inspect raw Supabase response
