-- issue 162: le dashboard chargeait toutes les transactions de la période puis
-- calculait KPI, répartition par catégorie et tendance en JS. PostgREST plafonne
-- une réponse à 1000 lignes : au-delà, les totaux étaient tronqués sans erreur.
-- Ces fonctions renvoient directement les agrégats (une ligne par catégorie ou
-- par mois). Elles ne changent aucune donnée. `security invoker` : la RLS de
-- l'appelant s'applique comme pour une lecture directe de `transactions`.
--
-- Parité avec l'ancien code TypeScript :
--  * comptes actifs seulement (accounts.deleted_at is null), transactions non supprimées ;
--  * dates lues en UTC ; les bornes comparent à minuit UTC comme l'ancien
--    `.gte("date", from).lte("date", to)` (voir analytics_aggregates, issue 121) ;
--  * remboursements liés (ADR 0004, issue 123) : une dépense compte pour son net
--    max(0, |montant| - remboursé), une dépense intégralement remboursée disparaît,
--    et un encaissement qui rembourse une dépense n'est plus un revenu. Les liens
--    sont lus sur tout l'espace, sans borne de date ni de compte.

-- Activité nette (dépenses + revenus) d'une fenêtre : une ligne par transaction.
-- p_scope : 'courant' | 'non_courant' | 'all' ; p_account_ids : null = tous les comptes du scope.
create or replace function public.dashboard_netted_activity(
  p_space_id uuid,
  p_scope text,
  p_account_ids uuid[],
  p_from date,
  p_to date,
  p_to_inclusive boolean default true
)
returns table (id uuid, month text, kind text, category_id uuid, net_cents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with reimbursed as (
    select r.reimburses_transaction_id as expense_id, sum(r.amount_cents) as total
    from public.transactions r
    where r.space_id = p_space_id
      and r.reimburses_transaction_id is not null
      and r.deleted_at is null
      and r.amount_cents > 0
    group by r.reimburses_transaction_id
  )
  select
    t.id,
    to_char(t.date at time zone 'utc', 'YYYY-MM') as month,
    t.kind,
    t.category_id,
    (case
      when t.kind = 'expense' then greatest(0, abs(t.amount_cents) - coalesce(rb.total, 0))
      else t.amount_cents
    end)::bigint as net_cents
  from public.transactions t
  join public.accounts a on a.id = t.account_id and a.space_id = p_space_id and a.deleted_at is null
  left join reimbursed rb on rb.expense_id = t.id
  where t.space_id = p_space_id
    and t.deleted_at is null
    and t.kind in ('expense', 'income')
    and t.reimburses_transaction_id is null
    and not (t.kind = 'expense' and rb.total is not null and abs(t.amount_cents) - rb.total <= 0)
    and (
      p_scope = 'all'
      or (p_scope = 'courant' and a.type = 'courant')
      or (p_scope = 'non_courant' and a.type <> 'courant')
    )
    and (p_account_ids is null or t.account_id = any (p_account_ids))
    and t.date >= p_from::timestamp at time zone 'utc'
    and (
      case
        when p_to_inclusive then t.date <= p_to::timestamp at time zone 'utc'
        else t.date < p_to::timestamp at time zone 'utc'
      end
    )
$$;

-- Totaux par (catégorie, nature) : KPI (somme des dépenses / des revenus),
-- répartition par catégorie et consommation des budgets.
create or replace function public.dashboard_category_totals(
  p_space_id uuid,
  p_scope text,
  p_account_ids uuid[],
  p_from date,
  p_to date,
  p_to_inclusive boolean default true
)
returns table (
  category_id uuid,
  name text,
  color text,
  icon text,
  is_default boolean,
  translation_key text,
  kind text,
  total_cents bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    n.category_id,
    c.name,
    c.color,
    c.icon,
    coalesce(c.is_default, false),
    c.translation_key,
    n.kind,
    sum(n.net_cents)::bigint as total_cents
  from public.dashboard_netted_activity(p_space_id, p_scope, p_account_ids, p_from, p_to, p_to_inclusive) n
  left join public.categories c on c.id = n.category_id
  group by n.category_id, c.name, c.color, c.icon, c.is_default, c.translation_key, n.kind
$$;

-- Totaux par (mois, nature) : tendance revenus / dépenses.
create or replace function public.dashboard_monthly_totals(
  p_space_id uuid,
  p_scope text,
  p_account_ids uuid[],
  p_from date,
  p_to date,
  p_to_inclusive boolean default true
)
returns table (month text, kind text, total_cents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select n.month, n.kind, sum(n.net_cents)::bigint as total_cents
  from public.dashboard_netted_activity(p_space_id, p_scope, p_account_ids, p_from, p_to, p_to_inclusive) n
  group by n.month, n.kind
$$;

-- Somme (hors solde initial) des opérations de chaque compte actif comptant
-- dans le solde : strictement après l'ancrage du compte (ADR 0003), sans borne
-- haute. Tous les types de compte, toutes natures d'opération.
create or replace function public.dashboard_account_totals(p_space_id uuid)
returns table (account_id uuid, total_cents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.account_id, sum(t.amount_cents)::bigint as total_cents
  from public.transactions t
  join public.accounts a on a.id = t.account_id and a.space_id = p_space_id and a.deleted_at is null
  where t.space_id = p_space_id
    and t.deleted_at is null
    and (t.date at time zone 'utc')::date > a.balance_anchor_date
  group by t.account_id
$$;

-- Somme signée de toutes les opérations d'un type de comptes sur [p_from, p_to[
-- (« Épargne ce mois » : comptes non courants, mois en cours). Une seule ligne.
create or replace function public.dashboard_net_cents(
  p_space_id uuid,
  p_scope text,
  p_from date,
  p_to date
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(t.amount_cents), 0)::bigint
  from public.transactions t
  join public.accounts a on a.id = t.account_id and a.space_id = p_space_id and a.deleted_at is null
  where t.space_id = p_space_id
    and t.deleted_at is null
    and (
      p_scope = 'all'
      or (p_scope = 'courant' and a.type = 'courant')
      or (p_scope = 'non_courant' and a.type <> 'courant')
    )
    and t.date >= p_from::timestamp at time zone 'utc'
    and t.date < p_to::timestamp at time zone 'utc'
$$;

-- Progression des objectifs liés à une catégorie : somme des montants absolus
-- par catégorie liée à un objectif actif, sur les comptes actifs, historique complet.
create or replace function public.dashboard_goal_category_totals(p_space_id uuid)
returns table (category_id uuid, total_abs_cents bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select t.category_id, sum(abs(t.amount_cents))::bigint as total_abs_cents
  from public.transactions t
  join public.accounts a on a.id = t.account_id and a.space_id = p_space_id and a.deleted_at is null
  where t.space_id = p_space_id
    and t.deleted_at is null
    and t.category_id in (
      select g.linked_category_id
      from public.savings_goals g
      where g.space_id = p_space_id
        and g.deleted_at is null
        and g.linked_category_id is not null
    )
  group by t.category_id
$$;

-- Exécution réservée aux utilisateurs connectés (la RLS filtre ensuite).
revoke all on function public.dashboard_netted_activity(uuid, text, uuid[], date, date, boolean) from public, anon;
revoke all on function public.dashboard_category_totals(uuid, text, uuid[], date, date, boolean) from public, anon;
revoke all on function public.dashboard_monthly_totals(uuid, text, uuid[], date, date, boolean) from public, anon;
revoke all on function public.dashboard_account_totals(uuid) from public, anon;
revoke all on function public.dashboard_net_cents(uuid, text, date, date) from public, anon;
revoke all on function public.dashboard_goal_category_totals(uuid) from public, anon;

grant execute on function public.dashboard_netted_activity(uuid, text, uuid[], date, date, boolean) to authenticated;
grant execute on function public.dashboard_category_totals(uuid, text, uuid[], date, date, boolean) to authenticated;
grant execute on function public.dashboard_monthly_totals(uuid, text, uuid[], date, date, boolean) to authenticated;
grant execute on function public.dashboard_account_totals(uuid) to authenticated;
grant execute on function public.dashboard_net_cents(uuid, text, date, date) to authenticated;
grant execute on function public.dashboard_goal_category_totals(uuid) to authenticated;
