# 0002 — Shared expenses and settlements

Status: accepted (implemented in #51)

## Context

Two people keep their own accounts (personal spaces) and a joint budget (a shared
space, see ADR 0001). One of them pays the rent, internet and insurances from
their own account, the other pays the electricity, and the net is settled
between them. The payer's account, notes and import data must stay private.

## Decision

- The transaction **stays in the payer's personal space**; the personal views
  keep showing the full amount (real cash flow).
- Sharing creates a row in **`shared_expenses`**, in the shared space. It holds
  only what co-members may see: label, amount, date, common category, who paid,
  and the split. It links to the source through `source_transaction_id`, which
  co-members cannot read.
  - A separate table (rather than flag columns on `transactions`) keeps RLS
    uniform — every row is readable by the members of the space it lives in —
    instead of relying on hidden columns or views.
  - `amount_cents`, `currency`, `date`, `description` are **forced from the
    source** by `prepare_shared_expense()` (the client cannot lie about them) and
    kept in sync by `sync_shared_expense()`; the copy disappears when the source
    is soft-deleted or stops being an expense. Only `category_id` and `shares`
    are updatable (column privileges), and only by the payer.
  - Only expenses of a **personal** space can be shared, and only into a
    **shared** space; an expense on a joint account is already common and never
    creates a debt.
- The split is stored per expense as `shares` (`userId → percent`, sums to 100),
  **frozen at share time**. The space's `default_share_percent` (default 50) is
  only the starting value: the payer keeps that percent and the others split the
  rest equally (`lib/shared-expenses/split-shares.ts`). Changing the default
  never rewrites history.
- The **balance** is derived, never stored (`lib/shared-expenses/balance.ts`):
  every non-payer owes their share to the payer; a settlement moves money from
  debtor to creditor. Integer cents, rounding always lands on the payer so no
  cent leaks.
- A **settlement** (`settlements`) records "X paid Y back". It is normally
  linked to the payment the receiver actually got (their own income/transfer);
  amount and date are then taken from that transaction. Others see only the
  settlement, not the receiving account. Settlements are not editable: delete
  and record again.
- A member who leaves keeps their shared expenses in the space (frozen).

## Consequences

- Any new number shown in a shared space that should include shared expenses
  (budget consumption today; dashboard and analytics later) must add
  `shared_expenses` explicitly — they are not `transactions`.
- Access rules are covered by pgTAP (`supabase/tests/database/shared_expenses_rls.test.sql`).
- Not done yet: shared-space dashboard/analytics, and import rules that share a
  line automatically.
