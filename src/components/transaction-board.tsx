"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTransactionActions } from "@/hooks/use-transaction-actions";
import { computeOverview } from "@/lib/overview";
import { OverviewSummary } from "@/components/overview-summary";
import { CategoryBreakdown } from "@/components/category-breakdown";
import { TransactionList } from "@/components/transaction-list";
import { CategoryBoard } from "@/components/category-board";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { TypeOverviewSheet } from "@/components/type-overview-sheet";
import { SimilarTransactionsDialog } from "@/components/similar-transactions-dialog";
import { CreateRuleDialog } from "@/components/create-rule-dialog";
import type { Category, Transaction, TxType } from "@/lib/types";

type View = "overview" | "board";

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
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    handleCategoryChange,
    handleCategoryChangeMulti,
    handleTypeToggle,
    handleTypeChangeMulti,
    handleCardTypeToggle,
    handleCardTypeChangeMulti,
    handleNotesChange,
    handleDeleteTransaction,
    handleDeleteMulti,
    pendingSimilarMove,
    confirmSimilarMove,
    dismissSimilarMove,
    pendingRulePrompt,
    confirmCreateRule,
    dismissCreateRule,
  } = useTransactionActions(initialTransactions, categories);

  const [overviewType, setOverviewType] = useState<TxType | null>(null);
  const [view, setView] = useState<View>("overview");

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const highlightParam = searchParams.get("highlight");
  const highlightedIds = useMemo(
    () => new Set(highlightParam ? highlightParam.split(",").filter(Boolean) : []),
    [highlightParam],
  );

  useEffect(() => {
    if (highlightedIds.size === 0) return;

    const [firstId] = highlightedIds;
    document.getElementById(`transaction-${firstId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    const timeout = setTimeout(() => router.replace(pathname, { scroll: false }), 4000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the highlight param itself changes
  }, [highlightParam, view]);

  const overview = useMemo(
    () => computeOverview(transactions, categories),
    [transactions, categories],
  );

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions],
  );

  return (
    <div className={cn("flex flex-col gap-4", selectedIds.size > 0 && "pb-20")}>
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

      <TypeOverviewSheet
        type={overviewType}
        transactions={transactions}
        categories={categories}
        onOpenChange={(open) => !open && setOverviewType(null)}
        onCategoryChange={handleCategoryChange}
        onTypeToggle={handleTypeToggle}
        onCardTypeToggle={handleCardTypeToggle}
        onNotesChange={handleNotesChange}
        onDelete={handleDeleteTransaction}
      />

      <OverviewSummary
        overview={overview}
        categorizeHref={categorizeHref}
        onSelectType={setOverviewType}
      />

      {transactions.length > 0 && (
        <>
          {/* The board is still the fastest way to sort a pile of transactions, so
              it stays — just behind a toggle, rather than dominating the page. */}
          {/* Toggle is desktop-only: the board needs drag-and-drop and horizontal
              room, so small screens always get the list. */}
          <div className="hidden justify-end md:flex">
            <div className="flex gap-1 rounded-full bg-muted p-0.5">
              {(
                [
                  { value: "overview", label: "Overview", Icon: List },
                  { value: "board", label: "Board", Icon: LayoutGrid },
                ] as const
              ).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setView(value)}
                  aria-pressed={view === value}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    view === value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className={cn(view === "board" && "md:hidden")}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
              <CategoryBreakdown slices={overview.breakdown} />
              <TransactionList
                transactions={transactions}
                categories={categories}
                selectedIds={selectedIds}
                highlightedIds={highlightedIds}
                onToggleSelect={toggleSelect}
                onCategoryChange={handleCategoryChange}
                onTypeToggle={handleTypeToggle}
                onCardTypeToggle={handleCardTypeToggle}
                onNotesChange={handleNotesChange}
                onDelete={handleDeleteTransaction}
              />
            </div>
          </div>

          {view === "board" && (
            <CategoryBoard
              transactions={sorted}
              categories={categories}
              onCategoryChange={handleCategoryChange}
              onCategoryChangeMulti={handleCategoryChangeMulti}
              onTypeToggle={handleTypeToggle}
              onCardTypeToggle={handleCardTypeToggle}
              onNotesChange={handleNotesChange}
              onDelete={handleDeleteTransaction}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              highlightedIds={highlightedIds}
            />
          )}
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
          onDelete={() => handleDeleteMulti(Array.from(selectedIds))}
          onClear={clearSelection}
        />
      )}
    </div>
  );
}
