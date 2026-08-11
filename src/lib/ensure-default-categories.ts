import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What a brand-new account starts with — a spread wide enough that most of a
 * first statement lands somewhere, each with an icon already set so the
 * overview's "Where it went" sidebar reads as a set of recognizable symbols
 * from the very first upload rather than a column of identical grey tags.
 *
 * These are only a starting point: the user renames, reorders, deletes or
 * re-icons them like any other category (the changes are theirs alone — these
 * rows are per-user, inserted once), and this seed never runs again once the
 * account has any category at all.
 */
const DEFAULT_CATEGORIES: { name: string; icon: string }[] = [
  { name: "Groceries", icon: "shopping-cart" },
  { name: "Dining out", icon: "utensils" },
  { name: "Transport", icon: "car" },
  { name: "Housing", icon: "house" },
  { name: "Utilities", icon: "zap" },
  { name: "Shopping", icon: "shopping-bag" },
  { name: "Health", icon: "heart-pulse" },
  { name: "Entertainment", icon: "popcorn" },
  { name: "Subscriptions", icon: "repeat" },
  { name: "Other", icon: "shapes" },
];

export async function ensureDefaultCategories(supabase: SupabaseClient) {
  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true });

  if (count && count > 0) return;

  await supabase.from("categories").insert(
    DEFAULT_CATEGORIES.map(({ name, icon }, i) => ({
      name,
      icon,
      is_default: true,
      sort_order: i,
    })),
  );
}
