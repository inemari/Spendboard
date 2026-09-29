"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarSearch, Receipt, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRangeLabel, resolveRange, type ViewMode } from "@/lib/date-range";
import { formatAmount } from "@/lib/format";
import { useTransactionActions } from "@/hooks/use-transaction-actions";
import { computeOverview } from "@/lib/overview";
import { buildCategoryColorMap, NEUTRAL_SWATCH, UNCATEGORIZED_SWATCH } from "@/lib/category-colors";
import { OverviewSummary } from "@/components/overview-summary";
import { CategorySidebar, type CategoryFilter } from "@/components/category-sidebar";
import { TransactionList } from "@/components/transaction-list";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { TypeOverviewSheet } from "@/components/type-overview-sheet";
import { SimilarTransactionsDialog } from "@/components/similar-transactions-dialog";
import { CreateRuleDialog } from "@/components/create-rule-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { TimeframeSwitcher } from "@/components/timeframe-switcher";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category, CreditInvoice, Transaction, TxType } from "@/lib/types";

/** "all" shows everything, "unassigned" shows transactions with no
 *  credit_invoice_id, anything else is a specific invoice's id. */
type InvoiceFilter = "all" | "unassigned" | string;

function filterByInvoice(transactions: Transaction[], filter: InvoiceFilter): Transaction[] {
  if (filter === "all") return transactions;
  if (filter === "unassigned") return transactions.filter((t) => !t.credit_invoice_id);
  return transactions.filter((t) => t.credit_invoice_id === filter);
}

export function TransactionBoard({
  initialTransactions,
  categories,
  invoices = [],
  openInvoices = [],
}: {
  initialTransactions: Transaction[];
  categories: Category[];
  /** Every invoice the household has ever filed a credit transaction under —
   *  used for filtering (safe to filter by any invoice, open or not). */
  invoices?: CreditInvoice[];
  /** Invoices still eligible for a retroactive settlement tag — the same
   *  set the upload dialog offers. Empty (and the whole settlement UI
   *  hidden) for a solo user with no household. */
  openInvoices?: CreditInvoice[];
}) {
  const openInvoiceIds = useMemo(() => new Set(openInvoices.map((i) => i.id)), [openInvoices]);

  const {
    transactions,
    selectedIds,
    toggleSelect,
    clearSelection,
    handleCategoryChange,
    handleCategoryChangeMulti,
    handleTypeToggle,
    handleTypeChangeMulti,
    handleCardTypeToggle,
    handleCardTypeChangeMulti,
    handleInvoiceChange,
    handleInvoiceChangeMulti,
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
  } = useTransactionActions(initialTransactions, categories, invoices, openInvoiceIds);

  const [overviewType, setOverviewType] = useState<TxType | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>({ kind: "all" });
  const [invoiceFilter, setInvoiceFilter] = useState<InvoiceFilter>("all");
  const [listQuery, setListQuery] = useState("");
  const [draggedTransaction, setDraggedTransaction] = useState<Transaction | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

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
  }, [highlightParam]);

  // Same params the timeframe switcher reads, so the empty state can name the
  // timeframe that came back empty rather than always saying "this month".
  const viewParam = searchParams.get("view");
  const timeframeView: ViewMode =
    viewParam === "day" || viewParam === "week" || viewParam === "range" ? viewParam : "month";
  const timeframeLabel = formatRangeLabel(
    timeframeView,
    resolveRange(timeframeView, {
      date: searchParams.get("date") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    }),
  );

  const overview = useMemo(
    () => computeOverview(transactions, categories),
    [transactions, categories],
  );

  // Shared by the overview summary and category drop targets so category
  // identity stays stable throughout the page.
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

  const visibleTransactions = useMemo(
    () => filterByInvoice(categoryFilteredTransactions, invoiceFilter),
    [categoryFilteredTransactions, invoiceFilter],
  );

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

  function handleDragStart(event: DragStartEvent) {
    setDraggedTransaction(
      transactions.find((transaction) => transaction.id === String(event.active.id)) ?? null,
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggedTransaction(null);
    if (!event.over) return;

    const categoryId = event.over.data.current?.categoryId as string | null | undefined;
    if (categoryId === undefined) return;

    const transactionId = String(event.active.id);
    const ids =
      selectedIds.has(transactionId) && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [transactionId];

    if (ids.length > 1) handleCategoryChangeMulti(ids, categoryId);
    else handleCategoryChange(transactionId, categoryId);
  }

  return (
    <DndContext
      id="overview-transactions-dnd"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragCancel={() => setDraggedTransaction(null)}
      onDragEnd={handleDragEnd}
    >
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

      {/* One shared bar for date-range navigation, search, and settlement filtering. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
        <TimeframeSwitcher />

        {transactions.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder="Search…"
                aria-label="Search transactions"
                className="h-8 w-full pl-8 text-xs sm:w-48"
              />
            </div>
            {invoices.length > 0 && (
              <Select value={invoiceFilter} onValueChange={(v) => v && setInvoiceFilter(v)}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue>
                    {invoiceFilter === "all"
                      ? "All settlements"
                      : invoiceFilter === "unassigned"
                        ? "No settlement"
                        : (invoices.find((i) => i.id === invoiceFilter)?.label ?? "All settlements")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All settlements</SelectItem>
                  <SelectItem value="unassigned">No settlement</SelectItem>
                  {invoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </div>

      {transactions.length > 0 && (
        <>
          <div>
            <div className="grid gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:items-start">
              <section className="order-1 rounded-2xl border border-border/60 bg-card p-4 sm:p-5 lg:col-start-1 lg:row-start-1">
                <OverviewSummary
                  overview={overview}
                  categorizeHref="/categorize"
                  onSelectType={setOverviewType}
                />
              </section>

              <div className="order-2 min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
                <TransactionList
                  transactions={visibleTransactions}
                  categories={categories}
                  invoices={invoices}
                  openInvoiceIds={openInvoiceIds}
                  selectedIds={selectedIds}
                  highlightedIds={highlightedIds}
                  filterChip={filterChip}
                  query={listQuery}
                  draggable
                  onToggleSelect={toggleSelect}
                  onCategoryChange={handleCategoryChange}
                  onTypeToggle={handleTypeToggle}
                  onCardTypeToggle={handleCardTypeToggle}
                  onInvoiceChange={handleInvoiceChange}
                  onNotesChange={handleNotesChange}
                  onDelete={handleDeleteTransaction}
                />
              </div>

              <aside className="order-3 rounded-2xl border border-border/60 bg-card p-4 sm:p-5 lg:sticky lg:top-4 lg:col-start-1 lg:row-start-2 lg:max-h-[calc(100svh-2rem)] lg:overflow-y-auto">
                <CategorySidebar
                  categories={categories}
                  transactions={transactions}
                  totalCount={transactions.length}
                  uncategorizedCount={overview.uncategorizedCount}
                  uncategorizedSpent={overview.uncategorizedSpent}
                  colorMap={colorMap}
                  filter={categoryFilter}
                  onSelectFilter={setCategoryFilter}
                />
              </aside>
            </div>
          </div>

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
          openInvoices={openInvoices}
          onCategoryChange={(categoryId) =>
            handleCategoryChangeMulti(Array.from(selectedIds), categoryId)
          }
          onTypeChange={(type) => handleTypeChangeMulti(Array.from(selectedIds), type)}
          onCardTypeChange={(cardType) =>
            handleCardTypeChangeMulti(Array.from(selectedIds), cardType)
          }
          onInvoiceChange={(invoiceId) =>
            handleInvoiceChangeMulti(Array.from(selectedIds), invoiceId)
          }
          onDelete={() => handleDeleteMulti(Array.from(selectedIds))}
          onClear={clearSelection}
        />
      )}
    </div>
      <DragOverlay dropAnimation={null}>
        {draggedTransaction && (
          <div className="flex min-w-64 items-center justify-between gap-4 rounded-xl border bg-card px-4 py-3 text-sm shadow-xl">
            <span className="max-w-64 truncate font-medium">
              {draggedTransaction.description}
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {formatAmount(draggedTransaction.amount)}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
