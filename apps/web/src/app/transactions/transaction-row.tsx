"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/calculations";
import type { Transaction } from "@/lib/types";

interface Props {
  tx: Transaction;
  categoryName?: string;
  accountName?: string;
}

export function TransactionRow({ tx, categoryName, accountName }: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isExpense = tx.type === "expense";
  const isIncome = tx.type === "income";

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("transactions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", tx.id);

    setDeleting(false);
    if (error) {
      alert("Failed to delete: " + error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors group">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">
            {tx.merchant_name || tx.description || "Untitled"}
          </p>
          {tx.is_pending && (
            <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">
              pending
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {tx.date}
          {categoryName && <> · {categoryName}</>}
          {accountName && <> · {accountName}</>}
        </p>
      </div>

      <div className="flex items-center gap-3 ml-4">
        <p
          className={`font-semibold tabular-nums ${
            isIncome
              ? "text-green-600 dark:text-green-400"
              : isExpense
                ? "text-gray-900 dark:text-gray-100"
                : "text-gray-500"
          }`}
        >
          {isIncome ? "+" : isExpense ? "\u2212" : ""}
          {formatMoney(Math.abs(Number(tx.amount)))}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <Link
            href={`/transactions/${tx.id}/edit`}
            className="text-xs text-blue-600 hover:text-blue-700 px-1.5 py-1"
          >
            Edit
          </Link>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-500 hover:text-red-600 px-1.5 py-1"
            >
              Delete
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-red-600 font-medium hover:underline disabled:opacity-50"
              >
                {deleting ? "..." : "Confirm"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
