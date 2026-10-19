export type Transaction = {
  id: string;
  kind: "expense" | "income" | "transfer_debit" | "transfer_credit";
  amount_cents: number;
  currency: string;
  date: string;
  description: string;
  notes: string | null;
  is_imported: boolean;
  raw_import_data?: { raw_label?: string } | null;
  transfer_id: string | null;
  // Issue 123: reimbursement links. `amount_cents` is the real amount; `net_cents` the net of an expense.
  reimburses_transaction_id?: string | null;
  reimbursed_cents?: number;
  net_cents?: number | null;
  account_id: string;
  category_id: string | null;
  accounts: { name: string } | null;
  categories: { name: string; color: string | null; icon: string | null } | null;
  to_account: { id: string; name: string } | null;
  // PostgREST returns an object (1:1) or an array depending on the relation
  // cardinality; normalised by getShare().
  shared_expenses?: SharedRef | SharedRef[] | null;
};

type SharedRef = {
  id: string;
  space_id: string;
  category_id: string | null;
  paid_by?: string;
  shares?: Record<string, number>;
};

export const getShare = (tx: Transaction): SharedRef | null => {
  const raw = tx.shared_expenses;
  if (!raw) return null;
  return (Array.isArray(raw) ? raw[0] : raw) ?? null;
};

export type Account = { id: string; name: string };
export type Category = { id: string; name: string; kind: string; is_default?: boolean; translation_key?: string | null };

export type TypeFilter = "all" | "expense" | "income" | "transfer";
export const PER_PAGE = 25;
export type TransactionListInitial = {
  transactions: Transaction[];
  total: number;
  accounts: Account[];
  categories: Category[];
  spaceNames: Record<string, string>;
  type: TypeFilter;
  categorySelection: string;
};
