import { createClient } from "@/lib/supabase/server";
import { loadWorkspaceDataForRange } from "@/lib/workspace-data";
import { resolveRange, type ViewMode } from "@/lib/date-range";
import { AppHeader } from "@/components/app-header";
import { UploadButton } from "@/components/upload-button";
import { TransactionBoard } from "@/components/transaction-board";

export default async function MonthWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; month: string }>;
  searchParams: Promise<{ view?: string; date?: string; from?: string; to?: string }>;
}) {
  const { year, month } = await params;
  const yearNum = Number(year);
  const monthNum = Number(month);
  const { view: viewParam, date, from, to } = await searchParams;
  const view: ViewMode =
    viewParam === "day" || viewParam === "week" || viewParam === "range" ? viewParam : "month";

  const supabase = await createClient();
  // Every view — month included — loads by date range now, so the four tabs
  // can't disagree about which transactions belong to the span they name.
  const { userEmail, categories, categoriesError, transactions, transactionsError } =
    await loadWorkspaceDataForRange(
      supabase,
      resolveRange(view, { year: yearNum, month: monthNum, date, from, to }),
    );

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col">
      <AppHeader
        year={yearNum}
        month={monthNum}
        userEmail={userEmail}
        actions={<UploadButton year={yearNum} month={monthNum} categories={categories} />}
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
          year={yearNum}
          month={monthNum}
          initialTransactions={transactions}
          categories={categories}
          categorizeHref={`/${yearNum}/${monthNum}/categorize`}
        />
      </div>
    </div>
  );
}
