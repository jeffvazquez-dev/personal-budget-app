"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category, Account } from "@/lib/types";

interface Props {
  categories: Category[];
  accounts: Account[];
  householdId: string;
}

export function TransactionForm({ categories, accounts, householdId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const type = formData.get("type") as "income" | "expense";
    const amount = Math.abs(parseFloat(formData.get("amount") as string));
    const categoryId = formData.get("category_id") as string;
    const accountId = formData.get("account_id") as string;
    const date = formData.get("date") as string;
    const merchant = (formData.get("merchant_name") as string) || null;
    const description = (formData.get("description") as string) || null;

    if (!amount || amount <= 0) {
      setError("Amount must be greater than zero");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: insertError } = await supabase.from("transactions").insert({
      household_id: householdId,
      account_id: accountId,
      category_id: categoryId || null,
      amount: type === "expense" ? -amount : amount,
      type,
      date,
      merchant_name: merchant,
      description,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type */}
      <div>
        <label className="block text-sm font-medium mb-1">Type</label>
        <select
          name="type"
          required
          defaultValue="expense"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium mb-1">Amount</label>
        <input
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          placeholder="0.00"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
        />
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium mb-1">Category</label>
        <select
          name="category_id"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
        >
          <option value="">Uncategorized</option>
          <optgroup label="Expenses">
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parent_id ? "— " : ""}{c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Income">
            {incomeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Account */}
      <div>
        <label className="block text-sm font-medium mb-1">Account</label>
        <select
          name="account_id"
          required
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <input
          name="date"
          type="date"
          required
          defaultValue={today}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
        />
      </div>

      {/* Merchant */}
      <div>
        <label className="block text-sm font-medium mb-1">Merchant / Payee</label>
        <input
          name="merchant_name"
          type="text"
          placeholder="e.g. Publix, Shell, Payroll"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Notes (optional)</label>
        <input
          name="description"
          type="text"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 transition-colors"
        >
          {loading ? "Saving..." : "Save transaction"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
