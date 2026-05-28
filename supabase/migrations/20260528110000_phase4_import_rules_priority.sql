-- Phase 4: add priority ordering to csv_import_rules
alter table public.csv_import_rules
  add column if not exists priority integer not null default 0;

-- Initialize existing rules with sequential priorities
with ranked as (
  select id, row_number() over (partition by user_id order by created_at asc) - 1 as rn
  from public.csv_import_rules
)
update public.csv_import_rules r
set priority = ranked.rn
from ranked
where r.id = ranked.id;
