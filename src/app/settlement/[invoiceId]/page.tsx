import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadHousehold } from "@/lib/workspace-data";
import { AppHeader } from "@/components/app-header";
import { SettlementPanel } from "@/components/settlement-panel";

export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const supabase = await createClient();
  const household = await loadHousehold(supabase);

  if (!household.invoices.some((invoice) => invoice.id === invoiceId)) {
    notFound();
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col">
      <AppHeader userEmail={household.userEmail ?? undefined} />
      <SettlementPanel household={household} invoiceId={invoiceId} />
    </div>
  );
}
