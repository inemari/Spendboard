import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category } from "@/lib/types";

export async function createCategory(
  supabase: SupabaseClient,
  categories: Category[],
  name: string,
  parentId: string | null,
  /** A slug from `src/lib/category-icons.ts`. Null leaves the category without
   *  one, which renders an icon guessed from its name instead. */
  icon: string | null = null,
): Promise<{ error: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };

  const siblings = categories.filter((c) => c.parent_id === parentId);
  const normalized = trimmed.toLowerCase();
  if (siblings.some((c) => c.name.trim().toLowerCase() === normalized)) {
    return { error: "A category with that name already exists here." };
  }

  const { error } = await supabase.from("categories").insert({
    name: trimmed,
    parent_id: parentId,
    icon,
    sort_order: siblings.length,
  });

  if (error?.code === "23505") {
    return { error: "A category with that name already exists here." };
  }

  return { error: error?.message ?? null };
}
