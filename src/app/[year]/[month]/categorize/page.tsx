import { createClient } from "@/lib/supabase/server";
import { loadWorkspaceData } from "@/lib/workspace-data";
import { AppHeader } from "@/components/app-header";
import { CategorizePageClient } from "@/components/categorize-page-client";

export default async function CategorizePage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;
  const yearNum = Number(year);
  const monthNum = Number(month);

  const supabase = await createClient();
  const { userEmail, categories, transactions } = await loadWorkspaceData(
    supabase,
    yearNum,
    monthNum,
  );

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col">
      <AppHeader year={yearNum} month={monthNum} userEmail={userEmail} />
      <CategorizePageClient
        initialTransactions={transactions}
        categories={categories}
        backHref={`/${yearNum}/${monthNum}`}
      />
    </div>
  );
}
