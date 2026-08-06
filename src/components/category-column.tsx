"use client";

import { useDroppable } from "@dnd-kit/core";
import { DraggableTransactionCard } from "@/components/draggable-transaction-card";
import { formatSpend } from "@/lib/format";
import type { CategorySwatch } from "@/lib/category-colors";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

export type ColumnSection = {
  id: string;
  title: string;
  transactions: Transaction[];
};

export type ColumnActions = {
  categories: Category[];
  onCategoryChange: (id: string, categoryId: string | null) => void;
  onTypeToggle: (id: string, currentType: Transaction["type"]) => void;
  onCardTypeToggle: (
    id: string,
    currentCardType: Transaction["card_type"],
  ) => void;
  onNotesChange: (id: string, notes: string | null) => void;
  onDelete: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  highlightedIds: Set<string>;
};

function CardList({
  transactions,
  emptyLabel,
  categories,
  onCategoryChange,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
  onDelete,
  selectedIds,
  onToggleSelect,
  highlightedIds,
}: ColumnActions & { transactions: Transaction[]; emptyLabel: string }) {
  if (transactions.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-3 text-center text-[11px] text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <>
      {transactions.map((t) => (
        <DraggableTransactionCard
          key={t.id}
          transaction={t}
          categories={categories}
          onCategoryChange={(categoryId) => onCategoryChange(t.id, categoryId)}
          onTypeToggle={() => onTypeToggle(t.id, t.type)}
          onCardTypeToggle={() => onCardTypeToggle(t.id, t.card_type)}
          onNotesChange={(notes) => onNotesChange(t.id, notes)}
          onDelete={() => onDelete(t.id)}
          selected={selectedIds.has(t.id)}
          onToggleSelect={() => onToggleSelect(t.id)}
          highlighted={highlightedIds.has(t.id)}
          compact
        />
      ))}
    </>
  );
}

function SubcategorySection({
  section,
  ...actions
}: ColumnActions & { section: ColumnSection }) {
  const { setNodeRef, isOver } = useDroppable({ id: section.id });
  const spent = section.transactions.reduce(
    (sum, t) => sum + (t.amount < 0 ? -t.amount : 0),
    0,
  );
  const allSelected =
    section.transactions.length > 0 &&
    section.transactions.every((t) => actions.selectedIds.has(t.id));

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-1.5 rounded-md border-l-2 py-1 pl-2 transition-colors",
        isOver ? "border-l-primary bg-muted/60" : "border-l-border",
      )}
    >
      <div className="flex items-center gap-1.5">
        {section.transactions.length > 0 && (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() =>
              actions.onToggleSelectAll(section.transactions.map((t) => t.id))
            }
            aria-label={`Select all in ${section.title}`}
            className="size-3 shrink-0 cursor-pointer accent-primary"
          />
        )}
        <h4 className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">
          {section.title}
        </h4>
        <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
          {formatSpend(spent)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <CardList
          transactions={section.transactions}
          emptyLabel="Drop here"
          {...actions}
        />
      </div>
    </div>
  );
}

/**
 * A real kanban column: cards are always visible, not hidden behind an expand
 * click. Used both as the board's pinned Uncategorized pane and as one page
 * of the category carousel (`category-board.tsx`) — scaling to 10+ categories
 * comes from stepping through them one (or a swipe of a few) at a time rather
 * than summarizing every column down to a tile or showing them all at once.
 * This column's own capped height with an internal scrollbar keeps a busy
 * category from growing without bound either way.
 */
export function CategoryColumn({
  id,
  title,
  transactions,
  subcategories,
  swatch,
  emptyLabel = "Drop transactions here",
  bodyClassName,
  ...actions
}: {
  id: string;
  title: string;
  transactions: Transaction[];
  /** Subcategories render as nested drop zones inside this column, not as sibling columns. */
  subcategories: ColumnSection[];
  swatch: CategorySwatch;
  emptyLabel?: string;
  /** Overrides the card area's height cap — the pinned Uncategorized column
   *  uses viewport height instead of the fixed cap every other column gets. */
  bodyClassName?: string;
} & ColumnActions) {
  const hasSubcategories = subcategories.length > 0;

  const allTransactions = hasSubcategories
    ? [...transactions, ...subcategories.flatMap((s) => s.transactions)]
    : transactions;
  const spent = allTransactions.reduce(
    (sum, t) => sum + (t.amount < 0 ? -t.amount : 0),
    0,
  );
  const allSelected =
    allTransactions.length > 0 &&
    allTransactions.every((t) => actions.selectedIds.has(t.id));

  // Leaf columns keep the whole column as one drop target; columns with
  // subcategories split into a "General" zone plus one zone per subcategory,
  // since nested drop targets would otherwise compete for the same drop event.
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: hasSubcategories,
  });

  return (
    <div className="flex flex-col rounded-xl border border-border/60 bg-card ">
      <div
        className={cn(
          "flex flex-col gap-0.5 rounded-t-md px-3 py-2",
          swatch.soft,
        )}
      >
        <div className="flex items-center gap-1.5">
          {allTransactions.length > 0 && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                actions.onToggleSelectAll(allTransactions.map((t) => t.id))
              }
              aria-label={`Select all in ${title}`}
              className="size-3 shrink-0 cursor-pointer accent-current"
            />
          )}
          <h3 className="min-w-0 flex-1 truncate text-xs font-semibold">
            {title}
          </h3>
          {allTransactions.length > 0 && (
            <span className="shrink-0 text-[11px] font-medium tabular-nums">
              {allTransactions.length}
            </span>
          )}
        </div>
        <p className="text-[11px] font-medium tabular-nums opacity-80">
          {formatSpend(spent)}
        </p>
      </div>

      <div
        ref={hasSubcategories ? undefined : setNodeRef}
        className={cn(
          "flex min-h-20 flex-col gap-2 overflow-y-auto p-2 transition-colors",
          bodyClassName ?? "max-h-96",
          !hasSubcategories && isOver && "bg-primary/5",
        )}
      >
        <div
          ref={hasSubcategories ? setNodeRef : undefined}
          className={cn(
            "flex flex-col gap-1.5 rounded-md transition-colors",
            hasSubcategories && isOver && "bg-muted/60",
          )}
        >
          <CardList
            transactions={transactions}
            emptyLabel={hasSubcategories ? "Drop here" : emptyLabel}
            {...actions}
          />
        </div>
        {subcategories.map((section) => (
          <SubcategorySection key={section.id} section={section} {...actions} />
        ))}
      </div>
    </div>
  );
}
