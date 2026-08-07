"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SearchX } from "lucide-react";
import {
  CategoryColumn,
  type ColumnActions,
} from "@/components/category-column";
import { TransactionCard } from "@/components/transaction-card";
import { buildCategoryTree } from "@/lib/category-tree";
import {
  UNCATEGORIZED_SWATCH,
  type CategorySwatch,
} from "@/lib/category-colors";
import type { Category, Transaction } from "@/lib/types";

const UNCATEGORIZED_ID = "uncategorized";

/**
 * The "cockpit": every category (plus Uncategorized) as a fixed-height cell
 * in one wrapping grid, so the whole board is scannable without paging
 * through columns one at a time. Replaced the earlier pinned-column +
 * carousel shape — that one scaled to 10+ categories by showing a handful at
 * a time, this one scales by capping each cell's own height instead, trading
 * "everything is always fully expanded" for "everything is always visible."
 */
export function CategoryBoard({
  transactions,
  categories,
  colorMap,
  onCategoryChange,
  onCategoryChangeMulti,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
  onDelete,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  highlightedIds,
  query = "",
}: {
  transactions: Transaction[];
  categories: Category[];
  colorMap: Map<string, CategorySwatch>;
  onCategoryChange: (id: string, categoryId: string | null) => void;
  onCategoryChangeMulti: (ids: string[], categoryId: string | null) => void;
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
  /** Cell-name filter — owned by the shared toolbar above the board, so it
   *  sits in the same bar as the date-range switcher and view toggle. */
  query?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  // Shared across every cell, so opening a card anywhere on the board
  // collapses whichever other card was open — only one at a time.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // The card currently being dragged, rendered in a DragOverlay so it stays
  // visible in hand as it crosses column boundaries — a column's own
  // overflow-hidden/overflow-y-auto clips anything transformed past its
  // edge, which is why the card used to vanish mid-drag.
  const [activeTransaction, setActiveTransaction] = useState<Transaction | null>(null);

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    const found = transactions.find((t) => t.id === activeId);
    if (found) setActiveTransaction(found);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTransaction(null);
    const { active, over } = event;
    if (!over) return;

    const categoryId = over.id === UNCATEGORIZED_ID ? null : String(over.id);
    const activeId = String(active.id);

    // Dragging a card that's part of a multi-selection moves the whole selection.
    if (selectedIds.has(activeId) && selectedIds.size > 1) {
      onCategoryChangeMulti(Array.from(selectedIds), categoryId);
    } else {
      onCategoryChange(activeId, categoryId);
    }
  }

  const actions: ColumnActions = {
    categories,
    onCategoryChange,
    onTypeToggle,
    onCardTypeToggle,
    onNotesChange,
    onDelete,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    highlightedIds,
    expandedId,
    onToggleExpanded: (id) =>
      setExpandedId((prev) => (prev === id ? null : id)),
  };

  const cells = useMemo(() => {
    const uncategorizedCell = {
      id: UNCATEGORIZED_ID,
      title: "Uncategorized",
      transactions: transactions.filter((t) => !t.category_id),
      subcategories: [],
      swatch: UNCATEGORIZED_SWATCH,
    };

    const categoryCells = buildCategoryTree(categories).map(({ parent, children }) => ({
      id: parent.id,
      title: parent.name,
      transactions: transactions.filter((t) => t.category_id === parent.id),
      subcategories: children.map((child) => ({
        id: child.id,
        title: child.name,
        transactions: transactions.filter((t) => t.category_id === child.id),
      })),
      swatch: colorMap.get(parent.id) ?? UNCATEGORIZED_SWATCH,
    }));

    return [uncategorizedCell, ...categoryCells];
  }, [transactions, categories, colorMap]);

  // Filtering trims the grid down to matching cells — with everything already
  // visible at once there's no separate "paged" vs "filtered" layout to switch
  // between, unlike the old carousel.
  const filteredCells = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cells;
    return cells.filter(
      (cell) =>
        cell.title.toLowerCase().includes(q) ||
        cell.subcategories.some((s) => s.title.toLowerCase().includes(q)),
    );
  }, [cells, query]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="hidden flex-col gap-3 md:flex">
        {filteredCells.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            <SearchX className="size-5" />
            No categories match &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
            {filteredCells.map((cell) => (
              <CategoryColumn
                key={cell.id}
                id={cell.id}
                title={cell.title}
                transactions={cell.transactions}
                subcategories={cell.subcategories}
                swatch={cell.swatch}
                {...actions}
              />
            ))}
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTransaction && (
          <div className="rotate-1 opacity-90 shadow-lg">
            <TransactionCard
              transaction={activeTransaction}
              categories={categories}
              onCategoryChange={() => {}}
              onTypeToggle={() => {}}
              onCardTypeToggle={() => {}}
              onNotesChange={() => {}}
              onDelete={() => {}}
              compact
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
