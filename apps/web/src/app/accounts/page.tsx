import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data";
import { AccountsClient } from "./accounts-client";

export default async function AccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  if (!profile?.household_id) {
    return (
      <main className="min-h-screen p-8">
        <p>No household found. Please sign out and sign in again.</p>
      </main>
    );
  }

  const [{ data: accounts }, { data: items }] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("household_id", profile.household_id)
      .order("name"),
    supabase
      .from("plaid_items")
      .select(
        "id, plaid_item_id, institution_name, status, last_synced_at, created_at"
      )
      .eq("household_id", profile.household_id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
            <p className="text-sm text-gray-500 mt-1">
              Connect banks & cards via Plaid (Sandbox), choose accounts, sync
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Dashboard
          </Link>
        </div>

        <AccountsClient
          initialAccounts={accounts ?? []}
          initialItems={items ?? []}
        />
      </div>
    </main>
  );
}
