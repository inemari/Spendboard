import { createClient } from "@/lib/supabase/server";
import { AdminCategoriesPanel } from "@/components/admin-categories-panel";
import type { DefaultCategory } from "@/lib/types";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("default_categories")
    .select("id, name, icon, sort_order, parent_id")
    .order("sort_order");

  return (
    <>
      {error && (
        <p className="m-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load default categories: {error.message}
        </p>
      )}
      <AdminCategoriesPanel categories={(data ?? []) as DefaultCategory[]} />
    </>
  );
}
