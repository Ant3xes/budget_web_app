---
name: budget-add-api-route
description: Scaffold a new Next.js API route for the budget_web_app following established conventions: GET/POST/PATCH/DELETE in one file, withUser() auth helper, Zod validation, createServerSupabaseClient, soft delete via deleted_at, amounts as integer cents, error responses as { error: string }. Use when user asks to add or create an API route, endpoint, or backend handler in this project.
---

# budget-add-api-route

## Pattern

Every route lives in `app/api/[resource]/route.ts`. Canonical reference: `app/api/accounts/route.ts`.

## Checklist

- [ ] Import `createServerSupabaseClient` from `@/lib/supabase/server`
- [ ] Define a local `withUser()` returning `{ supabase, user }` or `null`
- [ ] Define Zod schemas above the HTTP handlers
- [ ] Each handler: `withUser()` → 401, `safeParse` payload → 400, then DB call → 400 on error
- [ ] Filter reads: `.eq("user_id", auth.user.id).is("deleted_at", null)`
- [ ] Soft delete: `update({ deleted_at: new Date().toISOString() })`
- [ ] Amounts: store as INTEGER cents — never floats
- [ ] Error shape: `NextResponse.json({ error: string }, { status: N })`
- [ ] Success shape: `{ ok: true }` for mutations, `{ [resource]: data }` for reads
- [ ] Dynamic `[id]` routes: `const { id } = await params` (params is a Promise in Next.js 16)

## withUser() pattern (copy-paste)

```ts
const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
};
```

## Zod conventions

- Amounts: `z.number().int().positive()` or `z.coerce.number().int()`
- Dates: `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`
- UUIDs: `z.string().uuid()`
- Optional FK: `z.string().uuid().optional().nullable()`
- Enums: `z.enum(["monthly", "quarterly", "yearly"])`

## Key pitfalls

- **409 conflicts**: unique constraint violations → return 409 with localized message (ex: budget duplicate on `(user_id, category_id, month)`)
- **Transfer integrity**: block PATCH/DELETE on transactions with `transfer_id` set
- **Dynamic [id] folder**: must have its own `route.ts`; get `id` via `const { id } = await params`
