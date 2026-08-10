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
    // h-svh (not min-h-svh) plus overflow-hidden: the categorize screen is a
    // fixed-viewport constellation, so it must not be allowed to grow taller
    // than the screen and introduce a scrollbar.
    <div className="mx-auto flex h-svh w-full max-w-[1600px] flex-col overflow-hidden">
      <AppHeader year={yearNum} month={monthNum} userEmail={userEmail} />
      <CategorizePageClient
        initialTransactions={transactions}
        categories={categories}
        backHref={`/${yearNum}/${monthNum}`}
      />
    </div>
  );
}
