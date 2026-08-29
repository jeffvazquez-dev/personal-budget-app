import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getAccounts, getTransactions } from "@/lib/data";
import { formatMoney } from "@/lib/calculations";
import { TransactionFilters } from "./transaction-filters";

interface Props {
  searchParams: Promise<{
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
  const year = now.getFullYear();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;

  const [categories, accounts, allTransactions] = await Promise.all([
    getCategories(),
    getAccounts(),
    getTransactions({ year, month }),
  ]);

  // Client-side style filtering (data already month-scoped)
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

  const monthLabel = new Date(year, month - 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
            <p className="text-sm text-gray-500 mt-0.5">{monthLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Dashboard
            </Link>
            <Link
              href="/transactions/new"
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5"
            >
              + Add
            </Link>
          </div>
        </div>

        {/* Filters */}
        <TransactionFilters
          categories={categories}
          accounts={accounts}
          currentMonth={month}
          currentCategory={params.category}
          currentAccount={params.account}
          currentQuery={params.q}
        />

        {/* List */}
        {transactions.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
            <p className="text-gray-500 mb-3">No transactions found.</p>
            <Link
              href="/transactions/new"
              className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Add a transaction
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-1">
            {transactions.map((tx) => {
              const isExpense = tx.type === "expense";
              const isIncome = tx.type === "income";
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {tx.merchant_name || tx.description || "Untitled"}
                      </p>
                      {tx.is_pending && (
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">
                          pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {tx.date}
                      {tx.category_id && (
                        <> · {categoryMap.get(tx.category_id) ?? "Unknown"}</>
                      )}
                      {tx.account_id && (
                        <> · {accountMap.get(tx.account_id) ?? ""}</>
                      )}
                    </p>
                  </div>
                  <p
                    className={`font-semibold tabular-nums ml-4 ${
                      isIncome
                        ? "text-green-600 dark:text-green-400"
                        : isExpense
                          ? "text-gray-900 dark:text-gray-100"
                          : "text-gray-500"
                    }`}
                  >
                    {isIncome ? "+" : isExpense ? "−" : ""}
                    {formatMoney(Math.abs(Number(tx.amount)))}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400">
          {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
        </p>
      </div>
    </main>
  );
}
