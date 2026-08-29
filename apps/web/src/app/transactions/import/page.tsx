import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getAccounts, getCurrentProfile } from "@/lib/data";
import { ImportForm } from "./import-form";

export default async function ImportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profile, categories, accounts] = await Promise.all([
    getCurrentProfile(),
    getCategories(),
    getAccounts(),
  ]);

  if (!profile?.household_id) {
    return (
      <main className="min-h-screen p-8">
        <p>No household found. Please sign out and sign in again.</p>
      </main>
    );
  }

  let accountList = accounts;
  if (accountList.length === 0) {
    const { data: newAccount } = await supabase
      .from("accounts")
      .insert({
        household_id: profile.household_id,
        name: "Cash / Default",
        type: "cash",
      })
      .select()
      .single();
    if (newAccount) accountList = [newAccount];
  }

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Import CSV</h1>
            <p className="text-sm text-gray-500 mt-1">
              Import transactions from Excel (export as CSV first)
            </p>
          </div>
          <Link
            href="/transactions"
            className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Back
          </Link>
        </div>

        <ImportForm
          categories={categories}
          accounts={accountList}
          householdId={profile.household_id}
        />
      </div>
    </main>
  );
}
