import { formatMoney } from "@/lib/calculations";
import type { BudgetProgress } from "@/lib/types";

interface Props {
  items: BudgetProgress[];
}

export function BudgetProgressList({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const width = Math.min(item.percent, 100);
        const barColor = item.isOver
          ? "bg-red-500"
          : item.percent >= 80
            ? "bg-amber-500"
            : "bg-blue-500";

        return (
          <div
            key={item.categoryId}
            className="rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3"
          >
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <span className="font-medium text-sm truncate">
                {item.categoryName}
              </span>
              <span
                className={`text-xs tabular-nums shrink-0 ${
                  item.isOver
                    ? "text-red-600 dark:text-red-400 font-medium"
                    : "text-gray-500"
                }`}
              >
                {formatMoney(item.spent)} / {formatMoney(item.budgetAmount)}
              </span>
            </div>

            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${width}%` }}
              />
            </div>

            <p className="text-xs mt-1.5 tabular-nums">
              {item.isOver ? (
                <span className="text-red-600 dark:text-red-400">
                  Over by {formatMoney(Math.abs(item.remaining))}
                </span>
              ) : (
                <span className="text-gray-500">
                  {formatMoney(item.remaining)} left
                </span>
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
