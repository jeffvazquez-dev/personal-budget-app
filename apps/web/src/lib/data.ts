import { createClient } from "@/lib/supabase/server";
import type { Transaction, Category, Account } from "./types";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order");

  if (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
  return data ?? [];
}

export async function getAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("Error fetching accounts:", error);
    return [];
  }
  return data ?? [];
}

export async function getTransactions(options?: {
  year?: number;
  month?: number;
}): Promise<Transaction[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("*")
    .is("deleted_at", null)
    .order("date", { ascending: false });

  if (options?.year && options?.month) {
    const start = `${options.year}-${String(options.month).padStart(2, "0")}-01`;
    const endMonth = options.month === 12 ? 1 : options.month + 1;
    const endYear = options.month === 12 ? options.year + 1 : options.year;
    const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    query = query.gte("date", start).lt("date", end);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }
  return data ?? [];
}

export async function getTransactionById(
  id: string
): Promise<Transaction | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("Error fetching transaction:", error);
    return null;
  }
  return data;
}
