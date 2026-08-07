import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureDefaultCategories } from "@/lib/ensure-default-categories";
import type { Category, Rule, Transaction } from "@/lib/types";

async function loadCategoriesAndRules(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await ensureDefaultCategories(supabase);

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, is_default, parent_id, sort_order")
    .order("sort_order")
    .order("name");

  const { data: rules, error: rulesError } = await supabase
    .from("rules")
    .select("id, category_id, created_at, conditions")
    .order("created_at", { ascending: false });

  return {
    userEmail: user?.email,
    categories: (categories ?? []) as Category[],
    categoriesError: categoriesError?.message ?? null,
    rules: (rules ?? []) as Rule[],
    rulesError: rulesError?.message ?? null,
  };
}

const TRANSACTION_COLUMNS =
  "id, month_id, date, description, location, notes, amount, category_id, type, card_type";

export async function loadWorkspaceData(supabase: SupabaseClient, year: number, month: number) {
  const shared = await loadCategoriesAndRules(supabase);

  const { data: monthRow } = await supabase
    .from("months")
    .select("id")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  let transactions: Transaction[] = [];
  let transactionsError: string | null = null;

  if (monthRow) {
    const { data, error } = await supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("month_id", monthRow.id);
    transactions = data ?? [];
    transactionsError = error?.message ?? null;
  }

  return { ...shared, transactions, transactionsError };
}

/**
 * Overview-only loader for the day/week/custom-range views — queries
 * transactions by date directly instead of resolving a single months row,
 * since a range can span or fall short of a whole calendar month.
 */
export async function loadWorkspaceDataForRange(
  supabase: SupabaseClient,
  range: { from: string; to: string },
) {
  const shared = await loadCategoriesAndRules(supabase);

  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .gte("date", range.from)
    .lte("date", range.to);

  return {
    ...shared,
    transactions: (data ?? []) as Transaction[],
    transactionsError: error?.message ?? null,
  };
}
