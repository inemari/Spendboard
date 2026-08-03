"use client";

import Link from "next/link";
import { useTransactionActions } from "@/hooks/use-transaction-actions";
import { SummaryBar } from "@/components/summary-bar";
import { TransactionCard } from "@/components/transaction-card";
import { CategoryBoard } from "@/components/category-board";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { Button } from "@/components/ui/button";
import type { Category, Transaction } from "@/lib/types";

export function TransactionBoard({
  initialTransactions,
  categories,
  categorizeHref,
}: {
  initialTransactions: Transaction[];
  categories: Category[];
  categorizeHref: string;
}) {
  const {
    transactions,
    totals,
    selectedIds,
    toggleSelect,
    clearSelection,
    handleCategoryChange,
    handleCategoryChangeMulti,
    handleTypeToggle,
    handleTypeChangeMulti,
    handleCardTypeToggle,
    handleCardTypeChangeMulti,
    handleNotesChange,
  } = useTransactionActions(initialTransactions, categories);

  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className={selectedIds.size > 0 ? "flex flex-col gap-6 pb-16" : "flex flex-col gap-6"}>
      <SummaryBar
        common={totals.common}
        personal={totals.personal}
        needReview={totals.needReview}
        overall={totals.overall}
        uncategorizedCount={totals.uncategorizedCount}
        needReviewCount={totals.needReviewCount}
      />

      {totals.uncategorizedCount > 0 && (
        <Button className="self-start" render={<Link href={categorizeHref} />}>
          Categorize {totals.uncategorizedCount} uncategorized
        </Button>
      )}

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No transactions yet for this month. Upload a statement above to get started.
        </p>
      ) : (
        <>
          {/* Desktop: drag-and-drop category columns. Selecting multiple cards and
              dragging any one of them moves the whole selection. */}
          <CategoryBoard
            transactions={sorted}
            categories={categories}
            onCategoryChange={handleCategoryChange}
            onCategoryChangeMulti={handleCategoryChangeMulti}
            onTypeToggle={handleTypeToggle}
            onCardTypeToggle={handleCardTypeToggle}
            onNotesChange={handleNotesChange}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />

          {/* Mobile: flat list, categorize via dropdown */}
          <div className="flex flex-col gap-2 md:hidden">
            {sorted.map((t) => (
              <TransactionCard
                key={t.id}
                transaction={t}
                categories={categories}
                onCategoryChange={(categoryId) => handleCategoryChange(t.id, categoryId)}
                onTypeToggle={() => handleTypeToggle(t.id, t.type)}
                onCardTypeToggle={() => handleCardTypeToggle(t.id, t.card_type)}
                onNotesChange={(notes) => handleNotesChange(t.id, notes)}
                selected={selectedIds.has(t.id)}
                onToggleSelect={() => toggleSelect(t.id)}
              />
            ))}
          </div>
        </>
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          categories={categories}
          onCategoryChange={(categoryId) =>
            handleCategoryChangeMulti(Array.from(selectedIds), categoryId)
          }
          onTypeChange={(type) => handleTypeChangeMulti(Array.from(selectedIds), type)}
          onCardTypeChange={(cardType) =>
            handleCardTypeChangeMulti(Array.from(selectedIds), cardType)
          }
          onClear={clearSelection}
        />
      )}
    </div>
  );
}
