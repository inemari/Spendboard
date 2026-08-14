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
 *
 * The list itself lives in the `default_categories` table (admin-managed via
 * /admin/categories), not hardcoded here — reading it fresh on every seed
 * means an admin's edits apply to the next new account without a code change.
 */
export async function ensureDefaultCategories(supabase: SupabaseClient) {
  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true });

  if (count && count > 0) return;

  const { data: defaults } = await supabase
    .from("default_categories")
    .select("id, name, icon, sort_order, parent_id")
    .order("sort_order");

  if (!defaults || defaults.length === 0) return;

  const parents = defaults.filter((d) => !d.parent_id);
  const children = defaults.filter((d) => d.parent_id);

  // One insert per parent (not a single bulk insert) so each seed row's id
  // can be mapped to the new per-user category id it was cloned into —
  // needed to resolve each subcategory's own parent_id below, since a fresh
  // `categories` row gets its own generated id, distinct from the
  // `default_categories` row it was seeded from.
  const idByDefaultId = new Map<string, string>();
  for (const parent of parents) {
    const { data } = await supabase
      .from("categories")
      .insert({ name: parent.name, icon: parent.icon, is_default: true, sort_order: parent.sort_order })
      .select("id")
      .single();
    if (data) idByDefaultId.set(parent.id, data.id);
  }

  const childRows = children
    .map((c) => ({
      name: c.name,
      icon: c.icon,
      is_default: true,
      sort_order: c.sort_order,
      parent_id: idByDefaultId.get(c.parent_id!) ?? null,
    }))
    .filter((c) => c.parent_id);

  if (childRows.length > 0) {
    await supabase.from("categories").insert(childRows);
  }
}
