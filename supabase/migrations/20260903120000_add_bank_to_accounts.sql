-- Dashboard redesign (plan §4.1): structured bank field for accounts.
--
-- Today the bank (BNP, N26, ...) only lives inside the free-text
-- `accounts.name` (e.g. "BNP Compte courant"). The new "soldes de comptes
-- groupés par banque" dashboard widget needs a queryable column instead of
-- parsing the name.
--
-- Free text (not an enum/CHECK constraint) on purpose: the PRD explicitly
-- calls for a "modular" account architecture (add/remove an account without
-- refactoring), so a fixed bank list would need a migration for every new
-- bank the user adds.
alter table public.accounts
  add column if not exists bank text;

comment on column public.accounts.bank is
  'Free-text bank/provider name (e.g. "BNP", "N26"). Nullable, no CHECK constraint by design — see migration header.';
