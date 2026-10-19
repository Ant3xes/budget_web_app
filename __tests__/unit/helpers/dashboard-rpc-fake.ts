/**
 * JS mirror of the dashboard_* SQL functions (migration 20261020090000), applied
 * to synthetic table rows so page-level tests keep exercising the old predicates
 * (account scope, soft deletes, windows, reimbursements). The real SQL is covered
 * by supabase/tests/database/dashboard_aggregates.test.sql (not run without Docker).
 */
type Row = Record<string, unknown>;
type Tables = Record<string, Row[] | null>;

const day = (value: unknown) => String(value).slice(0, 10);

function activeAccounts(tables: Tables, spaceId: unknown) {
  return (tables.accounts ?? []).filter((a) => a.space_id === spaceId && (a.deleted_at ?? null) === null);
}

function inScope(account: Row, scope: unknown) {
  return scope === "all" || (scope === "courant" ? account.type === "courant" : account.type !== "courant");
}

function netted(tables: Tables, args: Row) {
  const accounts = new Map(activeAccounts(tables, args.p_space_id).map((a) => [a.id, a]));
  const all = (tables.transactions ?? []).filter((t) => t.space_id === args.p_space_id && (t.deleted_at ?? null) === null);
  const reimbursed = new Map<unknown, number>();
  for (const r of all) {
    if (r.reimburses_transaction_id && Number(r.amount_cents) > 0) {
      reimbursed.set(r.reimburses_transaction_id, (reimbursed.get(r.reimburses_transaction_id) ?? 0) + Number(r.amount_cents));
    }
  }
  const ids = args.p_account_ids as unknown[] | null;
  const inclusive = args.p_to_inclusive !== false;
  return all.flatMap((t) => {
    const account = accounts.get(t.account_id);
    if (!account || !inScope(account, args.p_scope)) return [];
    if (t.kind !== "expense" && t.kind !== "income") return [];
    if (t.reimburses_transaction_id) return [];
    if (ids && !ids.includes(t.account_id)) return [];
    const d = day(t.date);
    if (d < String(args.p_from) || (inclusive ? d > String(args.p_to) : d >= String(args.p_to))) return [];
    const back = reimbursed.get(t.id);
    const net = t.kind === "expense" ? Math.max(0, Math.abs(Number(t.amount_cents)) - (back ?? 0)) : Number(t.amount_cents);
    if (t.kind === "expense" && back !== undefined && net === 0) return [];
    return [{ month: d.slice(0, 7), kind: t.kind as string, category: t.category_id ?? null, meta: t.categories as Row | null, net }];
  });
}

export function dashboardRpc(name: string, args: Row, tables: Tables): Row[] | number | null {
  if (name === "dashboard_category_totals") {
    const groups = new Map<string, Row & { total_cents: number }>();
    for (const n of netted(tables, args)) {
      const key = `${n.category}|${n.kind}`;
      const meta = n.meta;
      const row = groups.get(key) ?? {
        category_id: n.category, name: meta?.name ?? null, color: meta?.color ?? null, icon: meta?.icon ?? null,
        is_default: meta?.is_default ?? false, translation_key: meta?.translation_key ?? null, kind: n.kind, total_cents: 0,
      };
      row.total_cents += n.net;
      groups.set(key, row);
    }
    return [...groups.values()];
  }
  if (name === "dashboard_monthly_totals") {
    const groups = new Map<string, Row & { total_cents: number }>();
    for (const n of netted(tables, args)) {
      const key = `${n.month}|${n.kind}`;
      const row = groups.get(key) ?? { month: n.month, kind: n.kind, total_cents: 0 };
      row.total_cents += n.net;
      groups.set(key, row);
    }
    return [...groups.values()];
  }
  if (name === "dashboard_account_totals") {
    const accounts = new Map(activeAccounts(tables, args.p_space_id).map((a) => [a.id, a]));
    const totals = new Map<unknown, number>();
    for (const t of tables.transactions ?? []) {
      const account = accounts.get(t.account_id);
      if (!account || t.space_id !== args.p_space_id || (t.deleted_at ?? null) !== null) continue;
      if (day(t.date) <= day(account.balance_anchor_date)) continue;
      totals.set(t.account_id, (totals.get(t.account_id) ?? 0) + Number(t.amount_cents));
    }
    return [...totals].map(([account_id, total_cents]) => ({ account_id, total_cents }));
  }
  if (name === "dashboard_net_cents") {
    const accounts = new Map(activeAccounts(tables, args.p_space_id).map((a) => [a.id, a]));
    return (tables.transactions ?? []).reduce((sum, t) => {
      const account = accounts.get(t.account_id);
      if (!account || !inScope(account, args.p_scope) || t.space_id !== args.p_space_id || (t.deleted_at ?? null) !== null) return sum;
      const d = day(t.date);
      return d >= String(args.p_from) && d < String(args.p_to) ? sum + Number(t.amount_cents) : sum;
    }, 0);
  }
  if (name === "dashboard_goal_category_totals") {
    const accounts = new Set(activeAccounts(tables, args.p_space_id).map((a) => a.id));
    const linked = new Set(
      (tables.savings_goals ?? []).filter((g) => g.space_id === args.p_space_id && (g.deleted_at ?? null) === null && g.linked_category_id).map((g) => g.linked_category_id),
    );
    const totals = new Map<unknown, number>();
    for (const t of tables.transactions ?? []) {
      if (t.space_id !== args.p_space_id || (t.deleted_at ?? null) !== null || !accounts.has(t.account_id) || !linked.has(t.category_id)) continue;
      totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + Math.abs(Number(t.amount_cents)));
    }
    return [...totals].map(([category_id, total_abs_cents]) => ({ category_id, total_abs_cents }));
  }
  return null;
}
