"use client";

import { useTransactionActions } from "@/hooks/use-transaction-actions";
import { CategorizeScreen } from "@/components/categorize-screen";
import { SimilarTransactionsDialog } from "@/components/similar-transactions-dialog";
import { CreateRuleDialog } from "@/components/create-rule-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
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
  const {
    transactions,
    handleCategoryChange,
    handleTypeToggle,
    handleCardTypeToggle,
    handleNotesChange,
    handleDeleteTransaction,
    pendingSimilarMove,
    confirmSimilarMove,
    dismissSimilarMove,
    pendingRulePrompt,
    confirmCreateRule,
    dismissCreateRule,
    pendingDelete,
    confirmDelete,
    dismissDelete,
  } = useTransactionActions(initialTransactions, categories);

  const uncategorized = transactions.filter((t) => !t.category_id);

  return (
    <>
      <SimilarTransactionsDialog
        pending={pendingSimilarMove}
        categories={categories}
        onConfirm={confirmSimilarMove}
        onDismiss={dismissSimilarMove}
      />
      <CreateRuleDialog
        pending={pendingRulePrompt}
        onConfirm={confirmCreateRule}
        onDismiss={dismissCreateRule}
      />
      <DeleteConfirmDialog
        pending={pendingDelete}
        onConfirm={confirmDelete}
        onDismiss={dismissDelete}
      />
      <CategorizeScreen
        transactions={uncategorized}
        categories={categories}
        onCategoryChange={handleCategoryChange}
        onTypeToggle={handleTypeToggle}
        onCardTypeToggle={handleCardTypeToggle}
        onNotesChange={handleNotesChange}
        onDelete={handleDeleteTransaction}
        backHref={backHref}
      />
    </>
  );
}
