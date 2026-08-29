import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getAccounts, getCurrentProfile } from "@/lib/data";
import { TransactionForm } from "./transaction-form";

export default async function NewTransactionPage() {
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

  // Ensure at least one account exists
  let accountList = accounts;
  if (accountList.length === 0) {
    // Create a default cash account
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
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold tracking-tight mb-6">Add transaction</h1>
        <TransactionForm
          categories={categories}
          accounts={accountList}
          householdId={profile.household_id}
        />
      </div>
    </main>
  );
}
