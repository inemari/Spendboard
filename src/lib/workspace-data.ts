import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureDefaultCategories } from "@/lib/ensure-default-categories";
import type { Category, Rule, Transaction } from "@/lib/types";

/**
 * Categories + rules + the signed-in user, with no transactions and no
 * timeframe — what the Categories and Rules screens need, both of which are
 * account-wide and have nothing to do with dates.
 */
export async function loadCategoriesAndRules(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await ensureDefaultCategories(supabase);

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, is_default, parent_id, sort_order, icon")
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

/**
 * Transactions for a date span — the overview's only loader, covering all four
 * of its views (a month is just `resolveRange("month", …)`).
 *
 * Scoped by transaction `date`, never by `month_id`: `month_id` records which
 * month a file was *uploaded under*, so reading by it hid a statement's
 * July-dated rows on July's screen while counting them into August's total.
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

/**
 * Every transaction the user has, no timeframe at all — what the Categorize
 * screen works from. Sorting the pile is a "clear the backlog" job, not a
 * per-month one: scoping it to a month left uncategorized transactions
 * stranded on months the user had no reason to revisit.
 */
export async function loadAllTransactions(supabase: SupabaseClient) {
  const shared = await loadCategoriesAndRules(supabase);

  const { data, error } = await supabase.from("transactions").select(TRANSACTION_COLUMNS);

  return {
    ...shared,
    transactions: (data ?? []) as Transaction[],
    transactionsError: error?.message ?? null,
  };
}
