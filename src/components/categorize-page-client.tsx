"use client";

import { useTransactionActions } from "@/hooks/use-transaction-actions";
import { CategorizeScreen } from "@/components/categorize-screen";
import type { Category, Transaction } from "@/lib/types";

export function CategorizePageClient({
  initialTransactions,
  categories,
  backHref,
}: {
  initialTransactions: Transaction[];
  categories: Category[];
  backHref: string;
}) {
  const { transactions, handleCategoryChange, handleTypeToggle, handleCardTypeToggle, handleNotesChange } =
    useTransactionActions(initialTransactions, categories);

  const uncategorized = transactions.filter((t) => !t.category_id);

  return (
    <CategorizeScreen
      transactions={uncategorized}
      categories={categories}
      onCategoryChange={handleCategoryChange}
      onTypeToggle={handleTypeToggle}
      onCardTypeToggle={handleCardTypeToggle}
      onNotesChange={handleNotesChange}
      backHref={backHref}
    />
  );
}
