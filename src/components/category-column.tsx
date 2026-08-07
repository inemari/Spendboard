"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Inbox } from "lucide-react";
import { DraggableTransactionCard } from "@/components/draggable-transaction-card";
import { Checkbox } from "@/components/ui/checkbox";
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
  categories,
  onCategoryChange,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
  onDelete,
  selectedIds,
  onToggleSelect,
  highlightedIds,
}: ColumnActions & { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-dashed p-3 text-center text-[11px] text-muted-foreground">
        <Inbox className="size-4" />
        Drop here
      </div>
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

/** The single visible page of a cell — either the whole leaf category, or
 *  (when the category has subcategories) whichever section the dot nav below
 *  has selected. Its own droppable id, so a card dropped here always lands in
 *  exactly the section that's on screen. */
function SectionBody({
  section,
  ...actions
}: ColumnActions & { section: ColumnSection }) {
  const { setNodeRef, isOver } = useDroppable({ id: section.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2 transition-colors",
        isOver && "bg-primary/5",
      )}
    >
      <CardList transactions={section.transactions} {...actions} />
    </div>
  );
}

/**
 * A fixed-height "cockpit" cell: one per category (plus the Uncategorized
 * pile), all rendered together in a wrapping grid so every category is on
 * screen at once instead of paged through one at a time. Each cell caps its
 * own height and scrolls its card list internally, so a busy category never
 * grows the grid or throws its row out of alignment with its neighbors.
 *
 * A category with subcategories doesn't get sibling cells for each of
 * them — that would blow the "all visible at once" budget fast. Instead its
 * one cell pages between "General" and each subcategory via a dot nav at the
 * bottom, the same page-count-visible-at-a-glance idea the old carousel used
 * for categories, just one level down.
 */
export function CategoryColumn({
  id,
  title,
  transactions,
  subcategories,
  swatch,
  ...actions
}: {
  id: string;
  title: string;
  transactions: Transaction[];
  /** Subcategories page within this cell via the dot nav, not as sibling cells. */
  subcategories: ColumnSection[];
  swatch: CategorySwatch;
} & ColumnActions) {
  const hasSubcategories = subcategories.length > 0;
  const sections: ColumnSection[] = hasSubcategories
    ? [{ id, title: "General", transactions }, ...subcategories]
    : [{ id, title, transactions }];

  const [pageIndex, setPageIndex] = useState(0);
  const activePage = Math.min(pageIndex, sections.length - 1);
  const activeSection = sections[activePage];

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
  const activeSpent = activeSection.transactions.reduce(
    (sum, t) => sum + (t.amount < 0 ? -t.amount : 0),
    0,
  );

  return (
    <div className="group/category flex h-64 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className={cn("flex flex-col gap-0.5 px-3 py-2", swatch.soft)}>
        <div className="flex items-center gap-1.5">
          {allTransactions.length > 0 && (
            <Checkbox
              checked={allSelected}
              onCheckedChange={() =>
                actions.onToggleSelectAll(allTransactions.map((t) => t.id))
              }
              aria-label={`Select all in ${title}`}
              className="size-3 shrink-0 cursor-pointer opacity-0 group-hover/category:opacity-100 focus-visible:opacity-100"
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

      {hasSubcategories && (
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1">
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">
            {activeSection.title}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {formatSpend(activeSpent)}
          </span>
        </div>
      )}

      <SectionBody section={activeSection} {...actions} />

      {sections.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 border-t border-border/60 py-1.5">
          {sections.map((section, index) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setPageIndex(index)}
              aria-label={`Show ${section.title}`}
              aria-current={index === activePage}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                index === activePage
                  ? swatch.bar
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
