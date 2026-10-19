"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/constants";
import { initialTransactionFilters, transactionListParams } from "@/lib/transactions/list-filters";
import { PER_PAGE, type Account, type Category, type Transaction, type TransactionListInitial, type TypeFilter } from "@/lib/transactions/list-types";

export function useTransactionList(spaceKind: "personal" | "shared", initial?: TransactionListInitial) {
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>(initial?.transactions ?? []);
  const [total, setTotal] = useState(initial?.total ?? 0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(!initial);

  // Filters
  const defaults = initial ?? initialTransactionFilters(searchParams.get("type") ?? undefined, searchParams.get("category_id") ?? undefined);
  const [type, setType] = useState<TypeFilter>(defaults.type);
  const [accountId, setAccountId] = useState("");
  const [categorySelection, setCategorySelection] = useState(() => defaults.categorySelection);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");

  // Reference data
  const [accounts, setAccounts] = useState<Account[]>(initial?.accounts ?? []);
  // Évite d'afficher « Crée d'abord un compte » avant la fin du chargement (issue 102).
  const [accountsLoaded, setAccountsLoaded] = useState(!!initial);
  const [categories, setCategories] = useState<Category[]>(initial?.categories ?? []);

  const [spaceNames, setSpaceNames] = useState<Record<string, string>>(initial?.spaceNames ?? {});
  const totalPages = Math.ceil(total / PER_PAGE);
  const isUncategorized = categorySelection === UNCATEGORIZED_CATEGORY_ID;

  const loadRefData = useCallback(async () => {
    const [accRes, catRes] = await Promise.all([fetch("/api/accounts"), fetch("/api/categories")]);
    if (accRes.ok) {
      const d = (await accRes.json()) as { accounts: Account[] };
      setAccounts(d.accounts ?? []);
      setAccountsLoaded(true);
    }
    if (catRes.ok) {
      const d = (await catRes.json()) as { categories: Category[] };
      setCategories(d.categories ?? []);
    }
  }, []);

  const canShare = spaceKind === "personal";

  useEffect(() => {
    if (initial || !canShare) return;
    const loadSpaces = async () => {
      const res = await fetch("/api/spaces");
      if (!res.ok) return;
      const d = (await res.json()) as { spaces: { id: string; name: string }[] };
      setSpaceNames(Object.fromEntries((d.spaces ?? []).map((s) => [s.id, s.name])));
    };
    void loadSpaces();
  }, [canShare, initial]);

  const load = useCallback(
    async (p = page) => {
      setIsLoading(true);
      const params = transactionListParams({ type, accountId, categorySelection, dateFrom, dateTo, q }, p);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { transactions: Transaction[]; total: number };
        setTransactions(data.transactions);
        setTotal(data.total);
      }
      setIsLoading(false);
    },
    [type, page, accountId, categorySelection, dateFrom, dateTo, q],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reference data fetch on mount
    if (!initial) void loadRefData();
  }, [loadRefData, initial]);

  const filtersKey = transactionListParams({ type, accountId, categorySelection, dateFrom, dateTo, q }, 1).toString();
  const previousFilters = useRef(filtersKey);
  const lastRequest = useRef(initial ? filtersKey : null);
  useEffect(() => {
    const filtersChanged = previousFilters.current !== filtersKey;
    previousFilters.current = filtersKey;
    const requestedPage = filtersChanged ? 1 : page;
    const key = `${filtersKey}&requestedPage=${requestedPage}`;
    // issue 168: the server already supplied this first page, including in StrictMode.
    if (lastRequest.current === filtersKey && requestedPage === 1) {
      lastRequest.current = key;
      return;
    }
    if (lastRequest.current === key) return;
    lastRequest.current = key;
    if (filtersChanged) setPage(1);
    void load(requestedPage);
  }, [filtersKey, page, load]);

  return { transactions, total, page, setPage, isLoading, type, setType, accountId, setAccountId, categorySelection, setCategorySelection, dateFrom, setDateFrom, dateTo, setDateTo, q, setQ, qInput, setQInput, accounts, accountsLoaded, categories, spaceNames, totalPages, isUncategorized, canShare, load, loadRefData };
}
