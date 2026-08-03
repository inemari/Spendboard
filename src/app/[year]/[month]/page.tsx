import { createClient } from "@/lib/supabase/server";
import { ensureDefaultCategories } from "@/lib/ensure-default-categories";
import { SignOutButton } from "@/components/sign-out-button";
import { UploadDropzone } from "@/components/upload-dropzone";
import { TransactionBoard } from "@/components/transaction-board";
import { CategoryManagerDialog } from "@/components/category-manager-dialog";
import type { Category, Transaction } from "@/lib/types";

export default async function MonthWorkspacePage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;
  const yearNum = Number(year);
  const monthNum = Number(month);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await ensureDefaultCategories(supabase);

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, color, is_default, parent_id")
    .order("name");

  const { data: monthRow } = await supabase
    .from("months")
    .select("id")
    .eq("year", yearNum)
    .eq("month", monthNum)
    .maybeSingle();

  let transactions: Transaction[] = [];
  let transactionsError: string | null = null;
  if (monthRow) {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "id, month_id, date, description, location, notes, amount, category_id, type, card_type",
      )
      .eq("month_id", monthRow.id);
    transactions = data ?? [];
    transactionsError = error?.message ?? null;
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-[1600px] flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {monthNum}/{yearNum}
          </h1>
          <p className="text-sm text-muted-foreground">Signed in as {user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <CategoryManagerDialog categories={(categories ?? []) as Category[]} />
          <SignOutButton />
        </div>
      </header>

      {categoriesError && (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load categories: {categoriesError.message}
        </p>
      )}

      {transactionsError && (
        <p className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load transactions: {transactionsError}
        </p>
      )}

      <UploadDropzone year={yearNum} month={monthNum} />

      <TransactionBoard
        initialTransactions={transactions}
        categories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
