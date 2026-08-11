import { createClient } from "@/lib/supabase/server";
import { loadAllTransactions } from "@/lib/workspace-data";
import { AppHeader } from "@/components/app-header";
import { CategorizePageClient } from "@/components/categorize-page-client";

/**
 * Sorting the pile is account-wide, not per-month — the screen works from
 * every uncategorized transaction the user has, whatever month it fell in.
 */
export default async function CategorizePage() {
  const supabase = await createClient();
  const { userEmail, categories, transactions } = await loadAllTransactions(supabase);

  return (
    // h-svh (not min-h-svh) plus overflow-hidden: the categorize screen is a
    // fixed-viewport constellation, so it must not be allowed to grow taller
    // than the screen and introduce a scrollbar.
    <div className="mx-auto flex h-svh w-full max-w-[1600px] flex-col overflow-hidden">
      <AppHeader userEmail={userEmail} />
      <CategorizePageClient
        initialTransactions={transactions}
        categories={categories}
        backHref="/"
      />
    </div>
  );
}
