-- issue 121: /analytics lisait TOUTES les transactions du compte (soldes,
-- patrimoine net, progression des objectifs) puis les additionnait côté Node.
-- Ces trois fonctions renvoient directement les agrégats : une ligne par
-- (compte, mois) ou (catégorie, mois) au lieu d'une ligne par transaction.
-- Elles ne changent aucune donnée. `security invoker` : la RLS de l'appelant
-- s'applique comme pour une lecture directe de `transactions`.
--
-- Parité stricte avec l'ancien code TypeScript (les chiffres affichés ne
-- changent pas) : la date est lue en UTC, une opération compte dans le solde si
-- sa date (jour UTC) est strictement postérieure à l'ancrage du compte
-- (ADR 0003), et les bornes `<= p_today` comparent à minuit UTC comme
-- l'ancien `.lte("date", todayStr)`.

-- Somme mensuelle des opérations comptant dans le solde, par compte
-- (patrimoine net : aucune borne de date haute, comme avant).
create or replace function public.analytics_account_monthly_deltas(p_space_id uuid, p_account_ids uuid[])
returns table (account_id uuid, month text, total_cents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.account_id,
    to_char(t.date at time zone 'utc', 'YYYY-MM') as month,
    sum(t.amount_cents)::bigint as total_cents
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  where t.space_id = p_space_id
    and t.account_id = any (p_account_ids)
    and t.deleted_at is null
    and (t.date at time zone 'utc')::date > a.balance_anchor_date
  group by t.account_id, to_char(t.date at time zone 'utc', 'YYYY-MM')
$$;

-- Solde (hors solde initial) de chaque compte : jusqu'à aujourd'hui, et à la
-- fin de la période. `window_cents` garde la comparaison historique de la page
-- (date strictement avant minuit UTC de `p_window_to`, et jamais après
-- `p_today`).
create or replace function public.analytics_account_balances(
  p_space_id uuid,
  p_account_ids uuid[],
  p_today date,
  p_window_to date
)
returns table (account_id uuid, today_cents bigint, window_cents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.account_id,
    coalesce(sum(t.amount_cents) filter (where t.date <= p_today::timestamp at time zone 'utc'), 0)::bigint as today_cents,
    coalesce(
      sum(t.amount_cents) filter (
        where t.date <= p_today::timestamp at time zone 'utc'
          and t.date < p_window_to::timestamp at time zone 'utc'
      ),
      0
    )::bigint as window_cents
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  where t.space_id = p_space_id
    and t.account_id = any (p_account_ids)
    and t.deleted_at is null
    and (t.date at time zone 'utc')::date > a.balance_anchor_date
    and t.date <= p_today::timestamp at time zone 'utc'
  group by t.account_id
$$;

-- Progression des objectifs liés à une catégorie : somme des montants absolus
-- par (catégorie liée, mois), historique complet (pas d'ancrage : ce n'est pas
-- un solde, comme avant).
create or replace function public.analytics_goal_category_monthly(p_space_id uuid, p_account_ids uuid[])
returns table (category_id uuid, month text, total_abs_cents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.category_id,
    to_char(t.date at time zone 'utc', 'YYYY-MM') as month,
    sum(abs(t.amount_cents))::bigint as total_abs_cents
  from public.transactions t
  where t.space_id = p_space_id
    and t.account_id = any (p_account_ids)
    and t.deleted_at is null
    and t.category_id in (
      select g.linked_category_id
      from public.savings_goals g
      where g.space_id = p_space_id
        and g.deleted_at is null
        and g.linked_category_id is not null
    )
  group by t.category_id, to_char(t.date at time zone 'utc', 'YYYY-MM')
$$;

-- Les lectures analytics filtrent toutes sur (space_id, date) puis sur
-- account_id : l'index existant transactions_space_date_idx couvre déjà la
-- borne de dates ; celui-ci sert les agrégats par compte sans borne.
create index if not exists transactions_space_account_date_idx
  on public.transactions (space_id, account_id, date)
  where deleted_at is null;
