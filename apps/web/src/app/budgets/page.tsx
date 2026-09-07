import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getCategories,
  getBudgets,
  getCurrentProfile,
} from "@/lib/data";
import { MonthNav } from "@/components/month-nav";
import { BudgetsForm } from "./budgets-form";

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function BudgetsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;

  const [profile, categories, budgets] = await Promise.all([
    getCurrentProfile(),
    getCategories(),
    getBudgets(year, month),
  ]);

  if (!profile?.household_id) {
    return (
      <main className="min-h-screen p-8">
        <p>No household found. Please sign out and sign in again.</p>
      </main>
    );
  }

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const monthKey = `${year}-${String(month).padStart(2, "0")}-01`;

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
            <div className="mt-2">
              <MonthNav year={year} month={month} basePath="/budgets" />
            </div>
          </div>
          <Link
            href={`/dashboard?year=${year}&month=${month}`}
            className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Dashboard
          </Link>
        </div>

        <p className="text-sm text-gray-500 mb-6">
          Set monthly spending targets per category. Progress shows on the
          dashboard.
        </p>

        <BudgetsForm
          categories={expenseCategories}
          budgets={budgets}
          householdId={profile.household_id}
          monthKey={monthKey}
          year={year}
          month={month}
        />
      </div>
    </main>
  );
}
