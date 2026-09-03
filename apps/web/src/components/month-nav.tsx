"use client";

import Link from "next/link";

interface Props {
  year: number;
  month: number; // 1-12
  basePath: string; // e.g. "/dashboard" or "/transactions"
  extraParams?: Record<string, string | undefined>;
}

function buildHref(
  basePath: string,
  year: number,
  month: number,
  extra?: Record<string, string | undefined>
) {
  const params = new URLSearchParams();
  params.set("year", String(year));
  params.set("month", String(month));
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) params.set(k, v);
    }
  }
  return `${basePath}?${params.toString()}`;
}

export function MonthNav({ year, month, basePath, extraParams }: Props) {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const label = new Date(year, month - 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const now = new Date();
  const isCurrent =
    year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={buildHref(basePath, prevYear, prevMonth, extraParams)}
        className="rounded-lg border border-gray-300 dark:border-gray-700 px-2.5 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
        aria-label="Previous month"
      >
        ←
      </Link>
      <span className="text-sm font-medium min-w-[140px] text-center tabular-nums">
        {label}
      </span>
      <Link
        href={buildHref(basePath, nextYear, nextMonth, extraParams)}
        className="rounded-lg border border-gray-300 dark:border-gray-700 px-2.5 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
        aria-label="Next month"
      >
        →
      </Link>
      {!isCurrent && (
        <Link
          href={buildHref(
            basePath,
            now.getFullYear(),
            now.getMonth() + 1,
            extraParams
          )}
          className="text-xs text-blue-600 hover:text-blue-700 ml-1"
        >
          Today
        </Link>
      )}
    </div>
  );
}
