import { createClient } from "@/lib/supabase/server";
import { loadCategoriesAndRules } from "@/lib/workspace-data";
import { AppHeader } from "@/components/app-header";
import { CategoryManagerPanel } from "@/components/category-manager-panel";

/** Categories are account-wide — no timeframe, no transactions to load. */
export default async function CategoriesPage() {
  const supabase = await createClient();
  const { userEmail, categories, categoriesError } = await loadCategoriesAndRules(supabase);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col">
      <AppHeader userEmail={userEmail} />

      {categoriesError && (
        <p className="m-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load categories: {categoriesError}
        </p>
      )}

      <CategoryManagerPanel categories={categories} />
    </div>
  );
}
