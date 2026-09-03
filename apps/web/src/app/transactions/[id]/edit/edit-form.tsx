"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category, Account, Transaction } from "@/lib/types";

interface Props {
  transaction: Transaction;
  categories: Category[];
  accounts: Account[];
}

export function EditTransactionForm({
  transaction,
  categories,
  accounts,
}: Props) {
  const router = useRouter();

  const [type, setType] = useState<"income" | "expense">(
    transaction.type === "income" ? "income" : "expense"
  );
  const [amount, setAmount] = useState(
    String(Math.abs(Number(transaction.amount)))
  );
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? "");
  const [accountId, setAccountId] = useState(transaction.account_id);
  const [date, setDate] = useState(transaction.date);
  const [merchant, setMerchant] = useState(transaction.merchant_name ?? "");
  const [description, setDescription] = useState(
    transaction.description ?? ""
  );

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const filtered = categories.filter((c) => c.type === type);
    const parents = filtered.filter((c) => !c.parent_id);
    const children = filtered.filter((c) => c.parent_id);
    const options: { id: string; label: string; isParent: boolean }[] = [];

    for (const parent of parents) {
      const kids = children.filter((c) => c.parent_id === parent.id);
      if (kids.length > 0) {
        options.push({ id: parent.id, label: parent.name, isParent: true });
        for (const kid of kids) {
          options.push({ id: kid.id, label: `  ${kid.name}`, isParent: false });
        }
      } else {
        options.push({ id: parent.id, label: parent.name, isParent: false });
      }
    }
    return options;
  }, [categories, type]);

  // Clear category if it doesn't match the new type
  useEffect(() => {
    if (!categoryId) return;
    const cat = categories.find((c) => c.id === categoryId);
    if (cat && cat.type !== type) {
      setCategoryId("");
    }
  }, [type, categoryId, categories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const parsedAmount = Math.abs(parseFloat(amount));
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Amount must be greater than zero");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        account_id: accountId,
        category_id: categoryId || null,
        amount: type === "expense" ? -parsedAmount : parsedAmount,
        type,
        date,
        merchant_name: merchant.trim() || null,
        description: description.trim() || null,
      })
      .eq("id", transaction.id);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/transactions");
    router.refresh();
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", transaction.id);

    setDeleting(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    router.push("/transactions");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Type toggle */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Type</label>
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setType("expense")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              type === "expense"
                ? "bg-red-600 text-white"
                : "bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
            }`}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setType("income")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              type === "income"
                ? "bg-green-600 text-white"
                : "bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
            }`}
          >
            Income
          </button>
        </div>
      </div>

      {/* Amount */}
      <div>
        <label htmlFor="amount" className="block text-sm font-medium mb-1.5">
          Amount
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            $
          </span>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent pl-7 pr-3 py-2.5 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium mb-1.5">
          Category
        </label>
        <select
          id="category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Uncategorized</option>
          {categoryOptions.map((opt) => (
            <option
              key={opt.id}
              value={opt.isParent ? "" : opt.id}
              disabled={opt.isParent}
            >
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Account */}
      <div>
        <label htmlFor="account" className="block text-sm font-medium mb-1.5">
          Account
        </label>
        <select
          id="account"
          required
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <label htmlFor="date" className="block text-sm font-medium mb-1.5">
          Date
        </label>
        <input
          id="date"
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Merchant */}
      <div>
        <label htmlFor="merchant" className="block text-sm font-medium mb-1.5">
          Merchant / Payee
        </label>
        <input
          id="merchant"
          type="text"
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2.5 focus:outline-none focus:ring- ste-2 focus:ring-blue-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-1.5">
          Notes <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="notes"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 transition-colors"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/transactions")}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          Cancel
        </button>
      </div>

      {/* Delete zone */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-red-500 hover:text-red-600"
          >
            Delete transaction
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-sm text-red-600">Delete this transaction?</p>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-sm text-gray-500"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
