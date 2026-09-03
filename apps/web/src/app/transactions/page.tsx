import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getAccounts, getTransactions } from "@/lib/data";
import { MonthNav } from "@/components/month-nav";
import { TransactionFilters } from "./transaction-filters";
import { TransactionRow } from "./transaction-row";

interface Props {
  searchParams: Promise<{
    year?: string;
    month?: string;
    category?: string;
    account?: string;
    q?: string;
  }>;
}

export default async function TransactionsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;

  const [categories, accounts, allTransactions] = await Promise.all([
    getCategories(),
    getAccounts(),
    getTransactions({ year, month }),
  ]);

  let transactions = allTransactions;

  if (params.category) {
    transactions = transactions.filter((t) => t.category_id === params.category);
  }
  if (params.account) {
    transactions = transactions.filter((t) => t.account_id === params.account);
  }
  if (params.q) {
    const q = params.q.toLowerCase();
    transactions = transactions.filter(
      (t) =>
        t.merchant_name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
    );
  }

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
            <div className="mt-2">
              <MonthNav
                year={year}
                month={month}
                basePath="/transactions"
                extraParams={{
                  category: params.category,
                  account: params.account,
                  q: params.q,
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard?year=${year}&month=${month}`}
              className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Dashboard
            </Link>
            <Link
              href="/transactions/import"
              className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Import
            </Link>
            <Link
              href="/transactions/new"
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5"
            >
              + Add
            </Link>
          </div>
        </div>

        <TransactionFilters
          categories={categories}
          accounts={accounts}
          currentYear={year}
          currentMonth={month}
          currentCategory={params.category}
          currentAccount={params.account}
          currentQuery={params.q}
        />

        {transactions.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
            <p className="text-gray-500 mb-3">No transactions found.</p>
            <div className="flex justify-center gap-4">
              <Link
                href="/transactions/new"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Add a transaction
              </Link>
              <Link
                href="/transactions/import"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Import CSV
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-1">
            {transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                categoryName={
                  tx.category_id
                    ? categoryMap.get(tx.category_id)
                    : undefined
                }
                accountName={
                  tx.account_id ? accountMap.get(tx.account_id) : undefined
                }
              />
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400">
          {transactions.length} transaction
          {transactions.length !== 1 ? "s" : ""}
        </p>
      </div>
    </main>
  );
}
