export type AccountType = "checking" | "savings" | "credit" | "cash" | "investment" | "other";
export type TransactionType = "income" | "expense" | "transfer";
export type CategoryType = "income" | "expense" | "transfer";

export interface Household {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  household_id: string | null;
  full_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  household_id: string;
  name: string;
  type: AccountType;
  currency: string;
  plaid_account_id: string | null;
  plaid_item_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  household_id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  household_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  merchant_name: string | null;
  notes: string | null;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  transfer_pair_id: string | null;
  plaid_transaction_id: string | null;
  is_pending: boolean;
  is_recurring: boolean;
  confidence: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Budget {
  id: string;
  household_id: string;
  category_id: string;
  amount: number;
  month: string; // first day of month YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface CategoryTotal {
  categoryId: string;
  categoryName: string;
  parentId: string | null;
  type: CategoryType;
  total: number;
}

export interface MonthlySummary {
  income: number;
  expenses: number;
  net: number;
  categoryTotals: CategoryTotal[];
}
