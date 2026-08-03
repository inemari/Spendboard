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

  const { data: categories } = await supabase
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
  if (monthRow) {
    const { data } = await supabase
      .from("transactions")
      .select("id, month_id, date, description, amount, category_id, type")
      .eq("month_id", monthRow.id);
    transactions = data ?? [];
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-6xl flex-col gap-6 p-6">
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

      <UploadDropzone year={yearNum} month={monthNum} />

      <TransactionBoard
        initialTransactions={transactions}
        categories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
