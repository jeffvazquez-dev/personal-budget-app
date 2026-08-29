import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getTransactions } from "@/lib/data";
import { monthlySummary, formatMoney } from "@/lib/calculations";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [categories, transactions] = await Promise.all([
    getCategories(),
    getTransactions({ year, month }),
  ]);

  const summary = monthlySummary(transactions, categories, year, month);

  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">{monthName}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/transactions/new"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              + Add transaction
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3 mb-10">
          <SummaryCard
            label="Income"
            value={formatMoney(summary.income)}
            tone="positive"
          />
          <SummaryCard
            label="Expenses"
            value={formatMoney(summary.expenses)}
            tone="negative"
          />
          <SummaryCard
            label="Net"
            value={formatMoney(summary.net)}
            tone={summary.net >= 0 ? "positive" : "negative"}
          />
        </div>

        {/* Category breakdown */}
        <section>
          <h2 className="text-lg font-semibold mb-4">By category</h2>

          {summary.categoryTotals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center">
              <p className="text-gray-500 mb-3">No transactions this month yet.</p>
              <Link
                href="/transactions/new"
                className="inline-block rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2"
              >
                Add your first transaction
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {summary.categoryTotals.map((cat) => (
                <div
                  key={cat.categoryId}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3"
                >
                  <span className="font-medium">{cat.categoryName}</span>
                  <span
                    className={
                      cat.type === "income"
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-900 dark:text-gray-100"
                    }
                  >
                    {formatMoney(cat.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="mt-10 text-xs text-gray-400">
          Signed in as {user.email}
        </p>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const color =
    tone === "positive"
      ? "text-green-600 dark:text-green-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : "";

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
