import { createClient } from "@/lib/supabase/server";
import { loadWorkspaceData } from "@/lib/workspace-data";
import { AppHeader } from "@/components/app-header";
import { RulesManagerPanel } from "@/components/rules-manager-panel";

export default async function RulesPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;
  const yearNum = Number(year);
  const monthNum = Number(month);

  const supabase = await createClient();
  const { userEmail, categories, rules, rulesError } = await loadWorkspaceData(
    supabase,
    yearNum,
    monthNum,
  );

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col">
      <AppHeader year={yearNum} month={monthNum} userEmail={userEmail} />

      {rulesError && (
        <p className="m-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load rules: {rulesError}
        </p>
      )}

      <RulesManagerPanel rules={rules} categories={categories} />
    </div>
  );
}
