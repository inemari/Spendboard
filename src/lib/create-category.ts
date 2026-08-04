import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category } from "@/lib/types";

export async function createCategory(
  supabase: SupabaseClient,
  categories: Category[],
  name: string,
  parentId: string | null,
): Promise<{ error: string | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name is required." };

  const siblingCount = categories.filter((c) => c.parent_id === parentId).length;

  const { error } = await supabase.from("categories").insert({
    name: trimmed,
    parent_id: parentId,
    sort_order: siblingCount,
  });

  return { error: error?.message ?? null };
}
