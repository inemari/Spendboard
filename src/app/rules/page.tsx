import { createClient } from "@/lib/supabase/server";
import { loadCategoriesAndRules } from "@/lib/workspace-data";
import { AppHeader } from "@/components/app-header";
import { RulesManagerPanel } from "@/components/rules-manager-panel";

/** Rules are account-wide — no timeframe, no transactions to load. */
export default async function RulesPage() {
  const supabase = await createClient();
  const { userEmail, categories, rules, rulesError } = await loadCategoriesAndRules(supabase);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col">
      <AppHeader userEmail={userEmail} />

      {rulesError && (
        <p className="m-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load rules: {rulesError}
        </p>
      )}

      <RulesManagerPanel rules={rules} categories={categories} />
    </div>
  );
}
