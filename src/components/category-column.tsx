"use client";

import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Filter, Inbox, MoreVertical } from "lucide-react";
import { DraggableTransactionCard } from "@/components/draggable-transaction-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  /** Which card (if any) is expanded — shared across the whole board, so
   *  opening one card collapses whichever other card was open. */
  expandedId: string | null;
  onToggleExpanded: (id: string) => void;
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
  expandedId,
  onToggleExpanded,
}: ColumnActions & { transactions: Transaction[]; emptyLabel: string }) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-md border border-dashed p-3 text-center text-[11px] text-muted-foreground">
        <Inbox className="size-4" />
        {emptyLabel}
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
          expanded={expandedId === t.id}
          onToggleExpanded={() => onToggleExpanded(t.id)}
        />
      ))}
    </>
  );
}

/** One subcategory's zone within a cell — its own droppable id, shown only
 *  while its checkbox is on in the cell's filter. */
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
        "flex flex-col gap-1.5 border-l-2 p-1 transition-colors group/subcategory",
        isOver ? "border-l-primary bg-muted/60" : "border-l-border",
      )}
    >
      <div className="flex items-center gap-1.5">
        {section.transactions.length > 0 && (
          <Checkbox
            checked={allSelected}
            onCheckedChange={() =>
              actions.onToggleSelectAll(section.transactions.map((t) => t.id))
            }
            aria-label={`Select all in ${section.title}`}
            className="size-3 shrink-0 cursor-pointer opacity-0 group-hover/subcategory:opacity-100 focus-visible:opacity-100"
          />
        )}
        <h4
          className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground"
          title={section.title}
        >
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
 * A fixed-height "cockpit" cell: one per category (plus the Uncategorized
 * pile), all rendered together in a wrapping grid so every category is on
 * screen at once. Each cell caps its own height and scrolls its card list
 * internally, so a busy category never grows the grid or throws its row out
 * of alignment with its neighbors.
 *
 * A category with subcategories shows "General" (transactions with no
 * subcategory) plus every subcategory's own zone stacked in the same cell —
 * no sibling cells, no paging. Each visible zone is its own drop target, same
 * as before subcategories moved into a shared cell. A filter dropdown lets
 * the user hide zones they don't want to see or drop into right now (e.g.
 * only two subcategories, or only "General") — hiding a zone unmounts its
 * drop target along with it, so a hidden subcategory can't accidentally
 * receive a drop while it's filtered out.
 *
 * `compact` shrinks the cell for a category with nothing in it — same
 * dashed-border/colored-header/"Drop here" box any cell uses, just smaller,
 * so it's still instantly recognizable as a drop target rather than reading
 * as some other kind of UI element. Caller only passes `compact` for
 * categories that are actually empty (incl. all subcategories), so it skips
 * the subcategory zones/filter menu entirely and drops straight onto this
 * category's own id.
 */
export function CategoryColumn({
  id,
  title,
  transactions,
  subcategories,
  swatch,
  compact = false,
  ...actions
}: {
  id: string;
  title: string;
  transactions: Transaction[];
  /** Subcategories render as zones inside this cell, filterable by visibility. */
  subcategories: ColumnSection[];
  swatch: CategorySwatch;
  compact?: boolean;
} & ColumnActions) {
  if (compact) {
    return <CompactCategoryColumn id={id} title={title} swatch={swatch} />;
  }

  const hasSubcategories = subcategories.length > 0;
  const GENERAL_ID = `${id}__general`;
  const sections: ColumnSection[] = hasSubcategories
    ? [{ id: GENERAL_ID, title: "General", transactions }, ...subcategories]
    : [];

  const [visibleSectionIds, setVisibleSectionIds] =
    useState<Set<string> | null>(null);
  const visible = visibleSectionIds ?? new Set(sections.map((s) => s.id));

  function toggleSection(sectionId: string) {
    setVisibleSectionIds((prev) => {
      const next = new Set(prev ?? sections.map((s) => s.id));
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  const visibleSections = sections.filter((s) => visible.has(s.id));
  const isFiltered = visibleSections.length !== sections.length;

  // Dropping on the cell's shared "General" zone always lands there; the
  // per-subcategory zones (rendered below) each carry their own droppable id.
  const { setNodeRef, isOver } = useDroppable({
    id: hasSubcategories ? GENERAL_ID : id,
  });

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

  return (
    <div className="group/category col-[span_2] row-[span_4] flex flex-col overflow-hidden rounded-lg border-2 border-dashed bg-card/20">
      <div
        className={cn(
          "flex items-start justify-between gap-0.5 px-2 py-2",
          swatch.soft,
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="min-w-0 truncate text-xs font-semibold" title={title}>
            {title}
          </h3>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-medium tabular-nums opacity-80">
              {formatSpend(spent)}
            </p>
            {allTransactions.length > 0 && (
              <span className="shrink-0 text-[10px] font-medium tabular-nums rounded-full bg-white/50 aspect-square text-center">
                {allTransactions.length}
              </span>
            )}
          </div>
        </div>
        {(allTransactions.length > 0 || hasSubcategories) && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className={cn(
                    "shrink-0 opacity-0 group-hover/category:opacity-100 focus-visible:opacity-100",
                    isFiltered && "opacity-100 text-primary",
                  )}
                  aria-label={`${title} options`}
                />
              }
            >
              <MoreVertical className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {allTransactions.length > 0 && (
                <DropdownMenuCheckboxItem
                  checked={allSelected}
                  onCheckedChange={() =>
                    actions.onToggleSelectAll(allTransactions.map((t) => t.id))
                  }
                >
                  Select all
                </DropdownMenuCheckboxItem>
              )}
              {hasSubcategories && (
                <>
                  {allTransactions.length > 0 && <DropdownMenuSeparator />}
                  {sections.map((section) => (
                    <DropdownMenuCheckboxItem
                      key={section.id}
                      checked={visible.has(section.id)}
                      onCheckedChange={() => toggleSection(section.id)}
                    >
                      {section.title}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {isFiltered && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setVisibleSectionIds(null)}
                      >
                        Show all
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {!hasSubcategories && (
          <div
            ref={setNodeRef}
            className={cn(
              "flex flex-1 flex-col gap-2 rounded-md transition-colors",
              isOver && "bg-primary/5",
            )}
          >
            <CardList
              transactions={transactions}
              emptyLabel="Drop transactions here"
              {...actions}
            />
          </div>
        )}

        {hasSubcategories && visibleSections.length === 0 && (
          <div className="flex flex-col items-center gap-1 rounded-md border border-dashed p-3 text-center text-[11px] text-muted-foreground">
            <Filter className="size-4" />
            Every subcategory is filtered out.
          </div>
        )}

        {hasSubcategories &&
          visibleSections.map((section) =>
            section.id === GENERAL_ID ? (
              <div
                key={section.id}
                ref={setNodeRef}
                className={cn(
                  "flex flex-col gap-1.5 rounded-md transition-colors",
                  isOver && "bg-primary/5",
                )}
              >
                <CardList
                  transactions={section.transactions}
                  emptyLabel="Drop here"
                  {...actions}
                />
              </div>
            ) : (
              <SubcategorySection
                key={section.id}
                section={section}
                {...actions}
              />
            ),
          )}
      </div>
    </div>
  );
}

/** A shrunk `CategoryColumn` for a category with nothing in it — same shape
 *  (colored header, dashed border, "Drop here" box), just a fraction of the
 *  height, since there's no transaction list to make room for. */
function CompactCategoryColumn({
  id,
  title,
  swatch,
}: {
  id: string;
  title: string;
  swatch: CategorySwatch;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="group/category flex flex-col overflow-hidden rounded-lg border-2 border-dashed bg-card/20">
      <div className={cn("px-2 py-1.5", swatch.soft)}>
        <h3 className="min-w-0 truncate text-xs font-semibold" title={title}>
          {title}
        </h3>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-md p-1 text-center text-[11px] text-muted-foreground transition-colors",
          isOver && "bg-primary/5",
        )}
      >
        <Inbox className="size-3.5" />
        Drop here
      </div>
    </div>
  );
}

