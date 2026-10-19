import { z } from "zod";

import { GET as getAccounts } from "@/app/api/accounts/route";
import { GET as getCategories } from "@/app/api/categories/route";
import { GET as getSpaces } from "@/app/api/spaces/route";
import { unwrap } from "@/lib/supabase/unwrap";

// issue 168: reuse the existing readers in-process, never HTTP or a second
// implementation of their queries. Their space context is request-memoized.
async function readReferenceData<T>(reader: () => Promise<Response>, schema: z.ZodType<T>): Promise<T> {
  const response = await reader();
  const payload: unknown = await response.json();
  if (!response.ok) {
    const failure = z.object({ error: z.string() }).parse(payload);
    unwrap({ data: null, error: { message: failure.error } });
  }
  return schema.parse(payload);
}

const named = z.object({ id: z.string(), name: z.string() });
export const loadInitialAccounts = () => readReferenceData(getAccounts, z.object({ accounts: z.array(named) }));
export const loadInitialCategories = () => readReferenceData(getCategories, z.object({
  categories: z.array(named.extend({ kind: z.string(), is_default: z.boolean().optional(), translation_key: z.string().nullable().optional() })),
}));
export const loadInitialSpaces = () => readReferenceData(getSpaces, z.object({ spaces: z.array(named) }));

const sharedRef = z.object({
  id: z.string(), space_id: z.string(), category_id: z.string().nullable(),
  paid_by: z.string().optional(), shares: z.record(z.string(), z.number()).optional(),
});
export const initialTransactionsSchema = z.object({
  total: z.number(),
  transactions: z.array(z.object({
    id: z.string(), kind: z.enum(["expense", "income", "transfer_debit", "transfer_credit"]),
    amount_cents: z.number(), currency: z.string(), date: z.string(), description: z.string(),
    notes: z.string().nullable(), is_imported: z.boolean(),
    raw_import_data: z.object({ raw_label: z.string().optional() }).passthrough().nullable().optional(),
    transfer_id: z.string().nullable(), reimburses_transaction_id: z.string().nullable().optional(),
    reimbursed_cents: z.number().optional(), net_cents: z.number().nullable().optional(),
    account_id: z.string(), category_id: z.string().nullable(), accounts: z.object({ name: z.string() }).nullable(),
    categories: z.object({ name: z.string(), color: z.string().nullable(), icon: z.string().nullable() }).nullable(),
    to_account: named.nullable(), shared_expenses: z.union([sharedRef, z.array(sharedRef)]).nullable().optional(),
  })),
});
