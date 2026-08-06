"use client";

import { useDroppable } from "@dnd-kit/core";
import { ChevronDown } from "lucide-react";
import { DraggableTransactionCard } from "@/components/draggable-transaction-card";
import { formatSpend } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

export type TileSection = {
  id: string;
  title: string;
  transactions: Transaction[];
};

export type TileActions = {
  categories: Category[];
  onCategoryChange: (id: string, categoryId: string | null) => void;
  onTypeToggle: (id: string, currentType: Transaction["type"]) => void;
  onCardTypeToggle: (id: string, currentCardType: Transaction["card_type"]) => void;
  onNotesChange: (id: string, notes: string | null) => void;
  onDelete: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  highlightedIds: Set<string>;
};

/**
 * A drop target that shows how full it is. Used for a category's own bucket and
 * for each of its subcategories, so a drop never has to guess which level it hit.
 */
function DropSlot({
  id,
  label,
  count,
  depth = 0,
}: {
  id: string;
  label: string;
  count: number;
  depth?: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-dashed px-2 py-1.5 text-[11px] transition-colors",
        depth > 0 && "ml-3",
        isOver
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/70 text-muted-foreground",
      )}
    >
      <span className="min-w-0 flex-1 truncate">
        {depth > 0 && "↳ "}
        {label}
      </span>
      {count > 0 && <span className="shrink-0 tabular-nums">{count}</span>}
    </div>
  );
}

export function CategoryTile({
  id,
  title,
  transactions,
  subcategories,
  expanded,
  onToggleExpanded,
  ...actions
}: {
  id: string;
  title: string;
  transactions: Transaction[];
  subcategories: TileSection[];
  expanded: boolean;
  onToggleExpanded: () => void;
} & TileActions) {
  const hasSubcategories = subcategories.length > 0;
  const all = [...transactions, ...subcategories.flatMap((s) => s.transactions)];
  const spent = all.reduce((sum, t) => sum + (t.amount < 0 ? -t.amount : 0), 0);
  const allSelected = all.length > 0 && all.every((t) => actions.selectedIds.has(t.id));

  // Leaf tiles are one big drop target; tiles with subcategories delegate to
  // explicit slots instead, so a nested zone never loses the drop to its parent.
  const { setNodeRef, isOver } = useDroppable({ id, disabled: hasSubcategories });

  return (
    <div
      ref={hasSubcategories ? undefined : setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-card transition-colors",
        !hasSubcategories && isOver ? "border-primary bg-primary/5" : "border-border/60",
      )}
    >
      <div className="flex items-start gap-2 px-2.5 pt-2.5">
        {all.length > 0 && (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => actions.onToggleSelectAll(all.map((t) => t.id))}
            aria-label={`Select all in ${title}`}
            className="mt-0.5 size-3 shrink-0 cursor-pointer accent-primary"
          />
        )}
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          disabled={all.length === 0}
          className="flex min-w-0 flex-1 items-start gap-2 text-left disabled:cursor-default"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">{title}</span>
            <span className="block text-[11px] tabular-nums text-muted-foreground">
              {formatSpend(spent)}
              {all.length > 0 && ` · ${all.length}`}
            </span>
          </span>
          {all.length > 0 && (
            <ChevronDown
              className={cn(
                "mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform",
                expanded && "rotate-180",
              )}
            />
          )}
        </button>
      </div>

      <div className="flex flex-col gap-1 p-2.5 pt-2">
        <DropSlot
          id={id}
          label={hasSubcategories ? "General" : "Drop here"}
          count={transactions.length}
        />
        {subcategories.map((section) => (
          <DropSlot
            key={section.id}
            id={section.id}
            label={section.title}
            count={section.transactions.length}
            depth={1}
          />
        ))}
      </div>

      {expanded && all.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border/60 p-2.5">
          {all.map((t) => (
            <DraggableTransactionCard
              key={t.id}
              transaction={t}
              categories={actions.categories}
              onCategoryChange={(categoryId) => actions.onCategoryChange(t.id, categoryId)}
              onTypeToggle={() => actions.onTypeToggle(t.id, t.type)}
              onCardTypeToggle={() => actions.onCardTypeToggle(t.id, t.card_type)}
              onNotesChange={(notes) => actions.onNotesChange(t.id, notes)}
              onDelete={() => actions.onDelete(t.id)}
              selected={actions.selectedIds.has(t.id)}
              onToggleSelect={() => actions.onToggleSelect(t.id)}
              highlighted={actions.highlightedIds.has(t.id)}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}
