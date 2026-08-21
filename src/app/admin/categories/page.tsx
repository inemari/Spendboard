import { createClient } from "@/lib/supabase/server";
import { AdminCategoriesPanel } from "@/components/admin-categories-panel";
import type { AppUser, DefaultCategory } from "@/lib/types";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const [
    { data, error },
    { data: users, error: usersError },
  ] = await Promise.all([
    supabase
      .from("default_categories")
      .select("id, name, icon, sort_order, parent_id")
      .order("sort_order"),
    supabase.rpc("list_app_users"),
  ]);

  return (
    <>
      {(error || usersError) && (
        <p className="m-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load default categories: {error?.message ?? usersError?.message}
        </p>
      )}
      <AdminCategoriesPanel
        categories={(data ?? []) as DefaultCategory[]}
        users={(users ?? []) as AppUser[]}
      />
    </>
  );
}
