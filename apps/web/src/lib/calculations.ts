import type {
  Transaction,
  Category,
  CategoryTotal,
  MonthlySummary,
  Budget,
  BudgetProgress,
} from "./types";

/**
 * Pure calculation engine.
 * Rules:
 * - income:  sum of transactions where type = 'income'  (amount is positive)
 * - expenses: sum of absolute value of transactions where type = 'expense'
 * - transfers are ignored for net calculation
 * - soft-deleted transactions (deleted_at != null) are ignored
 * - pending transactions are included by default (can be filtered by caller)
 */

export function isActive(tx: Transaction): boolean {
  return tx.deleted_at === null;
}

export function filterByMonth(
  transactions: Transaction[],
  year: number,
  month: number // 1-12
): Transaction[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return transactions.filter((tx) => isActive(tx) && tx.date.startsWith(prefix));
}

export function sumIncome(transactions: Transaction[]): number {
  return transactions
    .filter((tx) => isActive(tx) && tx.type === "income")
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
}

export function sumExpenses(transactions: Transaction[]): number {
  return transactions
    .filter((tx) => isActive(tx) && tx.type === "expense")
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
}

export function calculateNet(income: number, expenses: number): number {
  return income - expenses;
}

export function categoryTotals(
  transactions: Transaction[],
  categories: Category[]
): CategoryTotal[] {
  const map = new Map<string, number>();

  for (const tx of transactions) {
    if (!isActive(tx) || tx.type === "transfer" || !tx.category_id) continue;
    const current = map.get(tx.category_id) ?? 0;
    const value =
      tx.type === "expense"
        ? Math.abs(Number(tx.amount))
        : Number(tx.amount);
    map.set(tx.category_id, current + value);
  }

  const results: CategoryTotal[] = [];

  for (const [categoryId, total] of map) {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) continue;
    results.push({
      categoryId,
      categoryName: cat.name,
      parentId: cat.parent_id,
      type: cat.type,
      total,
    });
  }

  return results.sort((a, b) => b.total - a.total);
}

export function monthlySummary(
  transactions: Transaction[],
  categories: Category[],
  year: number,
  month: number
): MonthlySummary {
  const monthTx = filterByMonth(transactions, year, month);
  const income = sumIncome(monthTx);
  const expenses = sumExpenses(monthTx);
  const net = calculateNet(income, expenses);
  const totals = categoryTotals(monthTx, categories);

  return {
    income,
    expenses,
    net,
    categoryTotals: totals,
  };
}

/** Spent vs budget targets for expense categories */
export function budgetProgress(
  budgets: Budget[],
  categoryTotals: CategoryTotal[],
  categories: Category[]
): BudgetProgress[] {
  const spentMap = new Map(
    categoryTotals
      .filter((c) => c.type === "expense")
      .map((c) => [c.categoryId, c.total])
  );

  const results: BudgetProgress[] = [];

  for (const budget of budgets) {
    const cat = categories.find((c) => c.id === budget.category_id);
    if (!cat || cat.type !== "expense") continue;

    const budgetAmount = Number(budget.amount);
    if (budgetAmount <= 0) continue;

    const spent = spentMap.get(budget.category_id) ?? 0;
    const remaining = budgetAmount - spent;
    const percent = (spent / budgetAmount) * 100;

    results.push({
      categoryId: budget.category_id,
      categoryName: cat.name,
      budgetAmount,
      spent,
      remaining,
      percent,
      isOver: spent > budgetAmount,
    });
  }

  // Over-budget first, then highest % used
  return results.sort((a, b) => {
    if (a.isOver !== b.isOver) return a.isOver ? -1 : 1;
    return b.percent - a.percent;
  });
}

/** Format cents-safe money display */
export function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
