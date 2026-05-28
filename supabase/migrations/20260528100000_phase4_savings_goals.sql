-- Phase 4: add linked_category_id, color, icon to savings_goals
alter table public.savings_goals
  add column if not exists linked_category_id uuid references public.categories(id) on delete set null,
  add column if not exists color text,
  add column if not exists icon text;
