import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/constants";
import { PER_PAGE, type TypeFilter } from "@/lib/transactions/list-types";

export function initialTransactionFilters(type: string | undefined, category: string | undefined) {
  return { type: type === "expense" || type === "income" || type === "transfer" ? type : "all", categorySelection: category ?? "" } satisfies { type: TypeFilter; categorySelection: string };
}

export function transactionListParams(filters: { type: TypeFilter; accountId: string; categorySelection: string; dateFrom: string; dateTo: string; q: string }, page: number) {
  const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
  if (filters.type !== "all") params.set("kind", filters.type);
  if (filters.accountId) params.set("account_id", filters.accountId);
  if (filters.categorySelection === UNCATEGORIZED_CATEGORY_ID) params.set("uncategorized", "true");
  else if (filters.categorySelection) params.set("category_id", filters.categorySelection);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.q) params.set("q", filters.q);
  return params;
}
