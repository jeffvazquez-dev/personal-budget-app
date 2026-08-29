import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <p className="text-sm text-gray-500 mb-1">Signed in as</p>
          <p className="font-medium">{user.email}</p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <p className="text-sm text-gray-500">Income</p>
            <p className="text-2xl font-semibold mt-1">—</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <p className="text-sm text-gray-500">Expenses</p>
            <p className="text-2xl font-semibold mt-1">—</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <p className="text-sm text-gray-500">Net</p>
            <p className="text-2xl font-semibold mt-1">—</p>
          </div>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Auth is working. Next: database schema + real calculations.
        </p>
      </div>
    </main>
  );
}
