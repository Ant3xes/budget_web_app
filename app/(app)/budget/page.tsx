import { BudgetList } from "@/components/budget/budget-list";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawMonth = params.month;
  const monthParam = typeof rawMonth === "string" && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : null;

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = monthParam ?? defaultMonth;

  return (
    <section className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Budget</h1>
      <BudgetList initialMonth={month} />
    </section>
  );
}
