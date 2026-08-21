import { createClient } from "@/lib/supabase/server";
import { loadWorkspaceDataForRange, loadHousehold } from "@/lib/workspace-data";
import { resolveRange, type ViewMode } from "@/lib/date-range";
import { AppHeader } from "@/components/app-header";
import { UploadButton } from "@/components/upload-button";
import { TransactionBoard } from "@/components/transaction-board";

/**
 * The overview — the only screen with a timeframe, and so the only one whose
 * URL carries any date state. Everything hangs off an optional `date` anchor
 * (`?view` picks how wide a span to draw around it), which is why there's no
 * `[year]/[month]` route segment: a bare `/` is simply the current month.
 */
export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; from?: string; to?: string }>;
}) {
  const { view: viewParam, date, from, to } = await searchParams;
  const view: ViewMode =
    viewParam === "day" || viewParam === "week" || viewParam === "range" ? viewParam : "month";

  const range = resolveRange(view, { date, from, to });

  const supabase = await createClient();
  const [{ userEmail, categories, categoriesError, transactions, transactionsError }, { householdId, invoices, settlements }] =
    await Promise.all([loadWorkspaceDataForRange(supabase, range), loadHousehold(supabase)]);

  const settledInvoiceIds = new Set(settlements.map((s) => s.invoice_id));
  const openInvoices = invoices.filter((i) => !settledInvoiceIds.has(i.id));

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col">
      <AppHeader
        userEmail={userEmail}
        actions={<UploadButton categories={categories} householdId={householdId} openInvoices={openInvoices} />}
      />

      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
        {categoriesError && (
          <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load categories: {categoriesError}
          </p>
        )}

        {transactionsError && (
          <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load transactions: {transactionsError}
          </p>
        )}

        <TransactionBoard
          initialTransactions={transactions}
          categories={categories}
          invoices={invoices}
          openInvoices={openInvoices}
        />
      </div>
    </div>
  );
}
