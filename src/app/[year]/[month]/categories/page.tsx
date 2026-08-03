import { createClient } from "@/lib/supabase/server";
import { loadWorkspaceData } from "@/lib/workspace-data";
import { AppHeader } from "@/components/app-header";
import { CategoryManagerPanel } from "@/components/category-manager-panel";

export default async function CategoriesPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;
  const yearNum = Number(year);
  const monthNum = Number(month);

  const supabase = await createClient();
  const { userEmail, categories, categoriesError } = await loadWorkspaceData(
    supabase,
    yearNum,
    monthNum,
  );

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col">
      <AppHeader year={yearNum} month={monthNum} userEmail={userEmail} />

      {categoriesError && (
        <p className="m-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load categories: {categoriesError}
        </p>
      )}

      <CategoryManagerPanel categories={categories} />
    </div>
  );
}
