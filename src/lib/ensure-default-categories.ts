import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_CATEGORY_NAMES = [
  "Groceries",
  "Transport",
  "Housing",
  "Subscriptions",
  "Other",
];

export async function ensureDefaultCategories(supabase: SupabaseClient) {
  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true });

  if (count && count > 0) return;

  await supabase.from("categories").insert(
    DEFAULT_CATEGORY_NAMES.map((name, i) => ({
      name,
      is_default: true,
      sort_order: i,
    })),
  );
}
