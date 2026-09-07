"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/calculations";
import type { Category, Transaction } from "@/lib/types";

interface Props {
  initialItems: Transaction[];
  categories: Category[];
  threshold: number;
}

export function ReviewClient({ initialItems, categories, threshold }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const expenseCategories = useMemo(() => {
    const filtered = categories.filter((c) => c.type === "expense");
    const parents = filtered.filter((c) => !c.parent_id);
    const children = filtered.filter((c) => c.parent_id);
    const options: { id: string; label: string; disabled?: boolean }[] = [];

    for (const p of parents) {
      const kids = children.filter((c) => c.parent_id === p.id);
      if (kids.length > 0) {
        options.push({ id: p.id, label: p.name, disabled: true });
        for (const k of kids) {
          options.push({ id: k.id, label: `  ${k.name}` });
        }
      } else {
        options.push({ id: p.id, label: p.name });
      }
    }
    return options;
  }, [categories]);

  async function runAutoCategorize() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50, onlyUncategorized: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Categorization failed");
      } else {
        setMessage(
          `Processed ${data.processed}: ${data.updated} updated, ${data.needsReview} still need review`
        );
        router.refresh();
        // Soft refresh list by reloading
        window.location.reload();
      }
    } catch {
      setMessage("Network error");
    } finally {
      setRunning(false);
    }
  }

  async function confirmItem(transactionId: string, categoryId: string) {
    setBusyId(transactionId);
    try {
      const res = await fetch("/api/review/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, categoryId }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((t) => t.id !== transactionId));
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to save");
      }
    } catch {
      setMessage("Network error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runAutoCategorize}
          disabled={running}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
        >
          {running ? "Running AI…" : "Auto-categorize with AI"}
        </button>
        <span className="text-xs text-gray-400">
          Rules first, then history, then Groq (needs GROQ_API_KEY)
        </span>
      </div>

      {message && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-10 text-center text-gray-500">
          Nothing to review. Nice work.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((tx) => {
            const conf =
              tx.confidence !== null && tx.confidence !== undefined
                ? Number(tx.confidence)
                : null;
            const suggested =
              tx.category_id &&
              categories.find((c) => c.id === tx.category_id)?.name;

            return (
              <div
                key={tx.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {tx.merchant_name || tx.description || "Untitled"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {tx.date}
                      {suggested && <> · suggested: {suggested}</>}
                      {conf !== null && (
                        <> · confidence {Math.round(conf * 100)}%</>
                      )}
                      {conf !== null && conf < threshold && (
                        <span className="text-amber-600"> · low</span>
                      )}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums shrink-0">
                    {tx.type === "income" ? "+" : "\u2212"}
                    {formatMoney(Math.abs(Number(tx.amount)))}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    id={`cat-${tx.id}`}
                    defaultValue={tx.category_id ?? ""}
                    className="flex-1 min-w-[160px] rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1.5 text-sm"
                  >
                    <option value="">Uncategorized</option>
                    {expenseCategories.map((o) => (
                      <option
                        key={o.id + o.label}
                        value={o.disabled ? "" : o.id}
                        disabled={o.disabled}
                      >
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busyId === tx.id}
                    onClick={() => {
                      const el = document.getElementById(
                        `cat-${tx.id}`
                      ) as HTMLSelectElement | null;
                      const value = el?.value || "";
                      if (!value) {
                        setMessage("Pick a category first");
                        return;
                      }
                      confirmItem(tx.id, value);
                    }}
                    className="rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5"
                  >
                    {busyId === tx.id ? "…" : "Confirm"}
                  </button>
                  {tx.category_id && (
                    <button
                      type="button"
                      disabled={busyId === tx.id}
                      onClick={() => confirmItem(tx.id, tx.category_id!)}
                      className="rounded-lg border border-gray-300 dark:border-gray-700 text-sm px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-900"
                    >
                      Accept suggestion
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Confirming teaches a merchant rule so similar transactions auto-match next
        time.
      </p>
    </div>
  );
}
