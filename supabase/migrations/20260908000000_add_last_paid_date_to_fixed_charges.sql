-- Tracks when a fixed charge was last marked as paid by the user (issue #35
-- — the dashboard's "Charges fixes" widget shows charges already paid this
-- month, not just upcoming ones). No prior signal for "paid" existed:
-- `next_due_date` only tracks the next occurrence and auto-advances lazily
-- once it's overdue (see app/api/fixed-charges/route.ts's GET), which
-- doesn't distinguish "paid on time" from "just hasn't been advanced yet".
alter table public.fixed_charges add column if not exists last_paid_date date;
