"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category, Budget } from "@/lib/types";

interface Props {
  categories: Category[];
  budgets: Budget[];
  householdId: string;
  monthKey: string; // YYYY-MM-01
  year: number;
  month: number;
}

export function BudgetsForm({
  categories,
  budgets,
  householdId,
  monthKey,
  year,
  month,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const initialAmounts = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of budgets) {
      map[b.category_id] = String(Number(b.amount));
    }
    return map;
  }, [budgets]);

  const [amounts, setAmounts] = useState<Record<string, string>>(initialAmounts);

  // Hierarchical display: parents then children
  const rows = useMemo(() => {
    const parents = categories.filter((c) => !c.parent_id);
    const children = categories.filter((c) => c.parent_id);
    const list: { cat: Category; indent: boolean }[] = [];

    for (const parent of parents) {
      const kids = children.filter((c) => c.parent_id === parent.id);
      if (kids.length > 0) {
        // Prefer budgeting leaf categories; still show parent if no kids matched
        for (const kid of kids) {
          list.push({ cat: kid, indent: true });
        }
      } else {
        list.push({ cat: parent, indent: false });
      }
    }

    // Orphans
    const parentIds = new Set(parents.map((p) => p.id));
    for (const child of children) {
      if (!parentIds.has(child.parent_id!)) {
        list.push({ cat: child, indent: false });
      }
    }

    return list;
  }, [categories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const supabase = createClient();
    const existingByCat = new Map(budgets.map((b) => [b.category_id, b]));

    try {
      for (const { cat } of rows) {
        const raw = amounts[cat.id]?.trim() ?? "";
        const value = raw === "" ? 0 : parseFloat(raw);
        const existing = existingByCat.get(cat.id);

        if (!raw || isNaN(value) || value <= 0) {
          // Clear budget if empty / zero
          if (existing) {
            const { error: delError } = await supabase
              .from("budgets")
              .delete()
              .eq("id", existing.id);
            if (delError) throw delError;
          }
          continue;
        }

        if (existing) {
          const { error: updError } = await supabase
            .from("budgets")
            .update({ amount: value })
            .eq("id", existing.id);
          if (updError) throw updError;
        } else {
          const { error: insError } = await supabase.from("budgets").insert({
            household_id: householdId,
            category_id: cat.id,
            amount: value,
            month: monthKey,
          });
          if (insError) throw insError;
        }
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => {
        router.push(`/dashboard?year=${year}&month=${month}`);
        router.refresh();
      }, 800);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to save budgets";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm px-4 py-3">
          Budgets saved. Redirecting to dashboard…
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map(({ cat, indent }) => (
          <div
            key={cat.id}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <label
              htmlFor={`budget-${cat.id}`}
              className={`text-sm font-medium truncate ${indent ? "pl-4 text-gray-700 dark:text-gray-300" : ""}`}
            >
              {cat.name}
            </label>
            <div className="relative w-32 shrink-0">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                $
              </span>
              <input
                id={`budget-${cat.id}`}
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={amounts[cat.id] ?? ""}
                onChange={(e) =>
                  setAmounts((prev) => ({ ...prev, [cat.id]: e.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent pl-6 pr-2 py-1.5 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-gray-500">
          No expense categories found. Run the seed SQL first.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || rows.length === 0}
        className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 transition-colors"
      >
        {loading ? "Saving…" : "Save budgets"}
      </button>
    </form>
  );
}
