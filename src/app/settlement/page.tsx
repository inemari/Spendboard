import { createClient } from "@/lib/supabase/server";
import { loadHousehold } from "@/lib/workspace-data";
import { AppHeader } from "@/components/app-header";
import { SettlementPanel } from "@/components/settlement-panel";

/** Account/household-wide, like /categorize and /rules — a settlement isn't
 * scoped to any calendar timeframe, so this route carries no date state. */
export default async function SettlementPage() {
  const supabase = await createClient();
  const household = await loadHousehold(supabase);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col">
      <AppHeader userEmail={household.userEmail ?? undefined} />
      <SettlementPanel household={household} />
    </div>
  );
}
