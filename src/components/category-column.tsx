"use client";

import { useDroppable } from "@dnd-kit/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DraggableTransactionCard } from "@/components/draggable-transaction-card";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

export type CategorySection = {
  id: string;
  title: string;
  transactions: Transaction[];
};

type ActionProps = {
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
};

function TransactionList({
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
}: ActionProps & { transactions: Transaction[]; emptyLabel: string }) {
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
        />
      ))}
    </>
  );
}

function SubcategorySection({
  section,
  ...actions
}: ActionProps & { section: CategorySection }) {
  const { setNodeRef, isOver } = useDroppable({ id: section.id });
  const total = section.transactions.reduce((sum, t) => sum + t.amount, 0);
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
            aria-label={`Select all transactions in ${section.title}`}
            className="size-3 shrink-0 cursor-pointer accent-primary"
          />
        )}
        <h4 className="min-w-0 flex-1 truncate text-[11px] font-medium text-muted-foreground">
          {section.title}
        </h4>
        <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
          {formatAmount(total)}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <TransactionList
          transactions={section.transactions}
          emptyLabel="Drop here"
          {...actions}
        />
      </div>
    </div>
  );
}

export function CategoryColumn({
  id,
  title,
  transactions,
  subcategories,
  collapsed = false,
  onToggleCollapsed,
  ...actions
}: {
  id: string;
  title: string;
  transactions: Transaction[];
  /** Subcategories of this column's category, rendered as nested drop zones instead of sibling columns. */
  subcategories?: CategorySection[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
} & ActionProps) {
  const hasSubcategories = (subcategories?.length ?? 0) > 0;

  const allTransactions = hasSubcategories
    ? [...transactions, ...subcategories!.flatMap((s) => s.transactions)]
    : transactions;
  const total = allTransactions.reduce((sum, t) => sum + t.amount, 0);
  const allSelected =
    allTransactions.length > 0 &&
    allTransactions.every((t) => actions.selectedIds.has(t.id));

  // Leaf columns (no subcategories) keep the whole column as one drop target;
  // parent columns split into a "General" zone plus one zone per subcategory,
  // since nested drop targets would otherwise compete for the same drop event.
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: hasSubcategories,
  });

  if (collapsed) {
    return (
      <div
        ref={hasSubcategories ? undefined : setNodeRef}
        className={cn(
          "flex w-8 shrink-0 flex-col items-center rounded-lg border py-2 transition-colors",
          !hasSubcategories && isOver
            ? "border-primary bg-muted/60"
            : "border-border",
        )}
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={`Expand ${title}`}
          className="flex flex-1 flex-col items-center gap-2 text-primary"
        >
          <ChevronRight className="size-3.5 shrink-0" />
          <span className="[writing-mode:vertical-rl] truncate text-xs font-semibold">
            {title}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={hasSubcategories ? undefined : setNodeRef}
      className={cn(
        "flex w-52 shrink-0 flex-col rounded-lg border transition-colors",
        !hasSubcategories && isOver
          ? "border-primary bg-muted/60"
          : "border-border",
      )}
    >
      <div className="sticky top-0 z-10 flex flex-col gap-0.5 rounded-t-lg bg-primary px-2 py-1.5 text-primary-foreground">
        <div className="flex items-center gap-1.5">
          {allTransactions.length > 0 && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                actions.onToggleSelectAll(allTransactions.map((t) => t.id))
              }
              aria-label={`Select all transactions in ${title}`}
              className="size-3 shrink-0 cursor-pointer accent-primary-foreground"
            />
          )}
          <h3 className="min-w-0 flex-1 truncate text-xs font-semibold">
            {title}
          </h3>
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label={`Collapse ${title}`}
              className="shrink-0 text-primary-foreground/80 hover:text-primary-foreground"
            >
              <ChevronLeft className="size-3.5" />
            </button>
          )}
        </div>
        <p className="text-[11px] font-medium tabular-nums text-primary-foreground/80">
          {formatAmount(total)}
        </p>
      </div>

      <div className="flex min-h-24 flex-col gap-3 p-2">
        <div
          ref={hasSubcategories ? setNodeRef : undefined}
          className={cn(
            "flex flex-col gap-2 rounded-md transition-colors",
            hasSubcategories && isOver && "bg-muted/60",
          )}
        >
          <TransactionList
            transactions={transactions}
            emptyLabel={
              hasSubcategories ? "Drop here" : "Drop transactions here"
            }
            {...actions}
          />
        </div>
        {subcategories?.map((section) => (
          <SubcategorySection key={section.id} section={section} {...actions} />
        ))}
      </div>
    </div>
  );
}
