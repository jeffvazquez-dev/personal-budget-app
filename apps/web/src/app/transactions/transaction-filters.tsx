"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import type { Category, Account } from "@/lib/types";

interface Props {
  categories: Category[];
  accounts: Account[];
  currentYear: number;
  currentMonth: number;
  currentCategory?: string;
  currentAccount?: string;
  currentQuery?: string;
}

export function TransactionFilters({
  categories,
  accounts,
  currentYear,
  currentMonth,
  currentCategory,
  currentAccount,
  currentQuery,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(window.location.search);
      // Always keep year/month in the URL
      params.set("year", String(currentYear));
      params.set("month", String(currentMonth));
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, currentYear, currentMonth]
  );

  const expenseCats = categories.filter((c) => c.type === "expense");
  const parents = expenseCats.filter((c) => !c.parent_id);
  const children = expenseCats.filter((c) => c.parent_id);

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Category */}
      <select
        value={currentCategory ?? ""}
        onChange={(e) => updateParams("category", e.target.value)}
        className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All categories</option>
        {parents.map((p) => {
          const kids = children.filter((c) => c.parent_id === p.id);
          if (kids.length === 0) {
            return (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            );
          }
          return (
            <optgroup key={p.id} label={p.name}>
              {kids.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>

      {/* Account */}
      <select
        value={currentAccount ?? ""}
        onChange={(e) => updateParams("account", e.target.value)}
        className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All accounts</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      {/* Search */}
      <input
        type="search"
        placeholder="Search merchant..."
        defaultValue={currentQuery ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            updateParams("q", (e.target as HTMLInputElement).value);
          }
        }}
        onBlur={(e) => updateParams("q", e.target.value)}
        className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-2.5 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
