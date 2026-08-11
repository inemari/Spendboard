"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarSearch, LayoutGrid, List, Receipt, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRangeLabel, resolveRange, type ViewMode } from "@/lib/date-range";
import { useTransactionActions } from "@/hooks/use-transaction-actions";
import { computeOverview } from "@/lib/overview";
import { buildCategoryColorMap, NEUTRAL_SWATCH, UNCATEGORIZED_SWATCH } from "@/lib/category-colors";
import { OverviewSummary } from "@/components/overview-summary";
import { CategorySidebar, type CategoryFilter } from "@/components/category-sidebar";
import { TransactionList } from "@/components/transaction-list";
import { CategoryBoard } from "@/components/category-board";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { TypeOverviewSheet } from "@/components/type-overview-sheet";
import { SimilarTransactionsDialog } from "@/components/similar-transactions-dialog";
import { CreateRuleDialog } from "@/components/create-rule-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { TimeframeSwitcher } from "@/components/timeframe-switcher";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Category, Transaction, TxType } from "@/lib/types";

type View = "overview" | "board";

export function TransactionBoard({
  year,
  month,
  initialTransactions,
  categories,
  categorizeHref,
}: {
  year: number;
  month: number;
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
    pendingDelete,
    confirmDelete,
    dismissDelete,
  } = useTransactionActions(initialTransactions, categories);

  const [overviewType, setOverviewType] = useState<TxType | null>(null);
  const [view, setView] = useState<View>("overview");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>({ kind: "all" });
  // Each view keeps its own search text, so switching Overview <-> Board
  // doesn't clobber whichever query the other view had typed.
  const [listQuery, setListQuery] = useState("");
  const [boardQuery, setBoardQuery] = useState("");

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

  // Same params the timeframe switcher reads, so the empty state can name the
  // timeframe that came back empty rather than always saying "this month".
  const viewParam = searchParams.get("view");
  const timeframeView: ViewMode =
    viewParam === "day" || viewParam === "week" || viewParam === "range" ? viewParam : "month";
  const timeframeLabel = formatRangeLabel(
    timeframeView,
    resolveRange(timeframeView, {
      year,
      month,
      date: searchParams.get("date") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    }),
  );

  const overview = useMemo(
    () => computeOverview(transactions, categories),
    [transactions, categories],
  );

  const sorted = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions],
  );

  // Shared by the sidebar and the board's kanban columns, so a category's
  // color is the same in both places instead of each view deriving its own.
  const colorMap = useMemo(() => buildCategoryColorMap(categories), [categories]);

  // The category sidebar is the sole source of truth for which category is
  // selected — the list below never re-derives it, it just renders what it's given.
  const categoryFilteredTransactions = useMemo(() => {
    switch (categoryFilter.kind) {
      case "all":
        return transactions;
      case "uncategorized":
        return transactions.filter((t) => !t.category_id);
      case "category":
        return transactions.filter((t) => t.category_id && categoryFilter.categoryIds.includes(t.category_id));
    }
  }, [transactions, categoryFilter]);

  const filterChip = useMemo(() => {
    if (categoryFilter.kind === "uncategorized") {
      return { label: "Uncategorized", className: UNCATEGORIZED_SWATCH.soft };
    }
    if (categoryFilter.kind === "category") {
      const swatch = colorMap.get(categoryFilter.sliceId) ?? NEUTRAL_SWATCH;
      return { label: categoryFilter.name, className: swatch.soft };
    }
    return null;
  }, [categoryFilter, colorMap]);

  // Desktop-only since the board needs drag-and-drop and horizontal room.
  const viewToggle = (
    <div className="hidden gap-1 rounded-full bg-muted p-0.5 md:flex">
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

      <DeleteConfirmDialog
        pending={pendingDelete}
        onConfirm={confirmDelete}
        onDismiss={dismissDelete}
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

      {/* One shared bar for date-range navigation, the active view's search/
          filter field, and the Overview/Board toggle — keeping all of it off
          the board's own canvas is what gives the board its extra vertical
          room. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
        <TimeframeSwitcher year={year} month={month} />

        {transactions.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              {view === "overview" ? (
                <Input
                  value={listQuery}
                  onChange={(e) => setListQuery(e.target.value)}
                  placeholder="Search…"
                  className="h-8 w-full pl-8 text-xs sm:w-48"
                />
              ) : (
                <Input
                  value={boardQuery}
                  onChange={(e) => setBoardQuery(e.target.value)}
                  placeholder="Filter categories…"
                  className="h-8 w-full pl-8 text-xs sm:w-48"
                />
              )}
            </div>
            {viewToggle}
          </div>
        )}
      </div>

      {transactions.length > 0 && (
        <>
          <div className={cn(view === "board" && "md:hidden")}>
            <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] lg:items-start">
              <aside className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
                <OverviewSummary
                  overview={overview}
                  categorizeHref={categorizeHref}
                  onSelectType={setOverviewType}
                />
                <div className="flex flex-col gap-1.5 border-t border-border/60 pt-4">
                  <CategorySidebar
                    breakdown={overview.breakdown}
                    totalCount={transactions.length}
                    uncategorizedCount={overview.uncategorizedCount}
                    uncategorizedSpent={overview.uncategorizedSpent}
                    colorMap={colorMap}
                    filter={categoryFilter}
                    onSelectFilter={setCategoryFilter}
                  />
                </div>
              </aside>

              <TransactionList
                transactions={categoryFilteredTransactions}
                categories={categories}
                selectedIds={selectedIds}
                highlightedIds={highlightedIds}
                filterChip={filterChip}
                query={listQuery}
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
              colorMap={colorMap}
              query={boardQuery}
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

      {/* Without this the page is just the toolbar over blank space — every
          panel below is gated on having transactions, and the list's own
          "no transactions yet" state never mounts because the list doesn't
          render at all when the timeframe is empty. */}
      {transactions.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-16 text-center shadow-[0_4px_16px_rgba(224,64,160,0.08)] ring-1 ring-foreground/10">
          {/* `[animation-duration:2.4s]` stays an arbitrary property — the
              `animation-duration-[…]` utility the Tailwind IDE plugin
              suggests generates no CSS on the installed v4.3.3. */}
          <span className="flex size-16 animate-bounce items-center justify-center rounded-full bg-linear-to-br from-primary/20 via-secondary/20 to-tertiary/20 text-primary shadow-[0_6px_20px_rgba(224,64,160,0.18)] [animation-duration:2.4s] motion-reduce:animate-none">
            {timeframeView === "month" ? (
              <Receipt className="size-7" />
            ) : (
              <CalendarSearch className="size-7" />
            )}
          </span>
          <p className="font-heading text-lg font-bold">
            {timeframeView === "month"
              ? "Nothing here yet!"
              : "This stretch is squeaky clean"}
          </p>
          <Badge variant="secondary" className="h-7 px-3 text-sm">
            {timeframeLabel}
          </Badge>
          <p className="max-w-sm text-sm text-muted-foreground">
            {timeframeView === "month"
              ? "Upload a bank statement to fill this month up — or hop to another month with the arrows."
              : "Not a single transaction in this span. Stretch it wider, or step along to another one."}
          </p>
        </div>
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
