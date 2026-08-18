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
  //
  // The count check above is a plain read with no lock, so two concurrent
  // calls for the same brand-new user (e.g. Next.js prefetching several
  // routes at once) can both see zero categories and both reach this loop.
  // `categories_user_parent_name_key` (schema.sql) is what actually prevents
  // duplicates: the loser of the race gets a 23505 unique-violation on each
  // insert, which is treated as "someone already seeded this one" rather
  // than an error — its existing row is looked up instead so subcategory
  // remapping below still works.
  const idByDefaultId = new Map<string, string>();
  for (const parent of parents) {
    const { data, error } = await supabase
      .from("categories")
      .insert({ name: parent.name, icon: parent.icon, is_default: true, sort_order: parent.sort_order })
      .select("id")
      .single();

    if (data) {
      idByDefaultId.set(parent.id, data.id);
    } else if (error?.code === "23505") {
      const { data: existing } = await supabase
        .from("categories")
        .select("id")
        .is("parent_id", null)
        .eq("name", parent.name)
        .maybeSingle();
      if (existing) idByDefaultId.set(parent.id, existing.id);
    }
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

  for (const child of childRows) {
    const { error } = await supabase.from("categories").insert(child);
    if (error && error.code !== "23505") throw error;
  }
}
