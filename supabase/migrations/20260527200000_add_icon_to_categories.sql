-- Add icon column to categories (PRD v1.4)
alter table public.categories
  add column if not exists icon text;
