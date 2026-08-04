import { createClient } from "@/lib/supabase/server";
import { loadWorkspaceData } from "@/lib/workspace-data";
import { AppHeader } from "@/components/app-header";
import { UploadDropzone } from "@/components/upload-dropzone";
import { TransactionBoard } from "@/components/transaction-board";

export default async function MonthWorkspacePage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;
  const yearNum = Number(year);
  const monthNum = Number(month);

  const supabase = await createClient();
  const { userEmail, categories, categoriesError, transactions, transactionsError } =
    await loadWorkspaceData(supabase, yearNum, monthNum);

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col">
      <AppHeader year={yearNum} month={monthNum} userEmail={userEmail} />

      <div className="flex flex-col gap-6 p-6">
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

        <UploadDropzone year={yearNum} month={monthNum} categories={categories} />

        <TransactionBoard
          initialTransactions={transactions}
          categories={categories}
          categorizeHref={`/${yearNum}/${monthNum}/categorize`}
        />
      </div>
    </div>
  );
}
