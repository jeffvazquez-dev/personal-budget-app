import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getCategories,
  getAccounts,
  getTransactionById,
  getCurrentProfile,
} from "@/lib/data";
import { EditTransactionForm } from "./edit-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditTransactionPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profile, transaction, categories, accounts] = await Promise.all([
    getCurrentProfile(),
    getTransactionById(id),
    getCategories(),
    getAccounts(),
  ]);

  if (!transaction) notFound();
  if (!profile?.household_id) {
    return (
      <main className="min-h-screen p-8">
        <p>No household found. Please sign out and sign in again.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Edit transaction</h1>
          <Link
            href="/transactions"
            className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Back
          </Link>
        </div>
        <EditTransactionForm
          transaction={transaction}
          categories={categories}
          accounts={accounts}
        />
      </div>
    </main>
  );
}
