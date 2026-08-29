"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
  const amountRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [addAnother, setAddAnother] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Focus amount on mount and after "add another"
  useEffect(() => {
    amountRef.current?.focus();
  }, [success]);

  // Hierarchical category options for the current type
  const categoryOptions = useMemo(() => {
    const filtered = categories.filter((c) => c.type === type);
    const parents = filtered.filter((c) => !c.parent_id);
    const children = filtered.filter((c) => c.parent_id);

    const options: { id: string; label: string; isParent: boolean }[] = [];

    for (const parent of parents) {
      const kids = children.filter((c) => c.parent_id === parent.id);
      if (kids.length > 0) {
        // Parent as group header (not selectable if it has children)
        options.push({ id: parent.id, label: parent.name, isParent: true });
        for (const kid of kids) {
          options.push({ id: kid.id, label: `  ${kid.name}`, isParent: false });
        }
      } else {
        options.push({ id: parent.id, label: parent.name, isParent: false });
      }
    }

    // Orphan children (no parent in list)
    const parentIds = new Set(parents.map((p) => p.id));
    for (const child of children) {
      if (!parentIds.has(child.parent_id!)) {
        options.push({ id: child.id, label: child.name, isParent: false });
      }
    }

    return options;
  }, [categories, type]);

  // Reset category when type changes
  useEffect(() => {
    setCategoryId("");
  }, [type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const parsedAmount = Math.abs(parseFloat(amount));
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Amount must be greater than zero");
      setLoading(false);
      return;
    }

    if (!accountId) {
      setError("Please select an account");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: insertError } = await supabase.from("transactions").insert({
      household_id: householdId,
      account_id: accountId,
      category_id: categoryId || null,
      amount: type === "expense" ? -parsedAmount : parsedAmount,
      type,
      date,
      merchant_name: merchant.trim() || null,
      description: description.trim() || null,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    if (addAnother) {
      // Keep type, account, date — clear amount + merchant for speed
      setAmount("");
      setMerchant("");
      setDescription("");
      setSuccess("Saved! Add another below.");
      amountRef.current?.focus();
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm px-4 py-3">
          {success}
        </div>
      )}

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
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
          <input
            ref={amountRef}
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent pl-7 pr-3 py-2.5 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Category - hierarchical */}
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
              className={opt.isParent ? "font-semibold" : ""}
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
          placeholder="e.g. Publix, Shell, Payroll"
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Add another */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={addAnother}
          onChange={(e) => setAddAnother(e.target.checked)}
          className="rounded border-gray-300"
        />
        <span className="text-sm">Add another transaction after saving</span>
      </label>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 transition-colors"
        >
          {loading ? "Saving..." : addAnother ? "Save & add another" : "Save transaction"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
