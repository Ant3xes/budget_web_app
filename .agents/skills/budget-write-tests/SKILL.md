---
name: budget-write-tests
description: Write Vitest unit/integration tests and Playwright E2E tests for the budget_web_app following established patterns: mock next/headers + @/lib/supabase/server, createChainableMock for query chains, test 401/400/201 flows, E2E login() helper + role-based selectors. Use when user asks to write tests, add test coverage, or create test files for the budget app.
---

# budget-write-tests

## Vitest (API integration tests)

Reference: `__tests__/api/savings-goals.test.ts`, `__tests__/mocks/supabase.ts`

### Required mocks (always at top of file)

```ts
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));
import { createServerSupabaseClient } from "@/lib/supabase/server";
```

### Supabase mock — use the shared factory

```ts
import { createSupabaseMock } from "@/__tests__/mocks/supabase";

const { supabase } = createSupabaseMock();
vi.mocked(createServerSupabaseClient).mockResolvedValue(
  supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>
);
```

For unauthenticated tests: override `getUser` to return `{ data: { user: null }, error: null }`.

### 3 mandatory cases per handler

1. `401` — `getUser` returns null user
2. `400` — Zod rejects the payload (empty name, negative cents, bad UUID)
3. `200/201` — valid payload, mock DB returns success

## Playwright (E2E)

Reference: `e2e/features.spec.ts`, `e2e/auth.spec.ts`

### login() helper (copy into each spec file — not centralised)

```ts
async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(process.env.TEST_EMAIL ?? "test@budget.local");
  await page.getByLabel(/mot de passe|password/i).fill(process.env.TEST_PASSWORD ?? "Password1234!");
  await page.getByRole("button", { name: /connexion|se connecter|login/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}
```

### Selector rules

- Role-based: `getByRole("button", { name: /regex/i })`
- Regex for i18n: `/montant|amount/i`, `/créer|create/i`
- Multiple matches: `.first()`
- Dialog: `expect(page.getByRole("dialog")).toBeVisible()`

## File locations

- Vitest: `__tests__/api/[resource].test.ts`
- Playwright: add a `test.describe` block to `e2e/features.spec.ts`
