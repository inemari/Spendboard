import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureDefaultCategories } from "@/lib/ensure-default-categories";
import type { Category, Transaction } from "@/lib/types";

export async function loadWorkspaceData(supabase: SupabaseClient, year: number, month: number) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await ensureDefaultCategories(supabase);

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, color, is_default, parent_id, sort_order")
    .order("sort_order")
    .order("name");

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
      .select(
        "id, month_id, date, description, location, notes, amount, category_id, type, card_type",
      )
      .eq("month_id", monthRow.id);
    transactions = data ?? [];
    transactionsError = error?.message ?? null;
  }

  return {
    userEmail: user?.email,
    categories: (categories ?? []) as Category[],
    categoriesError: categoriesError?.message ?? null,
    transactions,
    transactionsError,
  };
}
