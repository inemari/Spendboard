import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureDefaultCategories } from "@/lib/ensure-default-categories";
import { resolveRange } from "@/lib/date-range";
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

/**
 * A calendar month's transactions — by transaction *date*, not by `month_id`.
 *
 * `month_id` is which month page a file was uploaded from, which is not the
 * same thing: the upload route stamps every row in a file with that one id,
 * so a statement spanning a month boundary (a credit-card period running
 * mid-month to mid-month, say) files its July-dated rows under August. Reading
 * by `month_id` therefore hid those rows on `/2026/7` while counting them into
 * August's total — and disagreed with the day/week/custom views right next to
 * it, which have always read by date. `months` rows still exist; they scope
 * uploads and the `(month_id, source_hash)` dedup key, not reads.
 */
export async function loadWorkspaceData(supabase: SupabaseClient, year: number, month: number) {
  return loadWorkspaceDataForRange(supabase, resolveRange("month", { year, month }));
}

/**
 * Loader for an arbitrary date span — the day/week/custom-range views, and
 * (via `loadWorkspaceData`) whole months too.
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
