"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DraggableTransactionCard } from "@/components/draggable-transaction-card";
import { CategoryTile, type TileActions } from "@/components/category-tile";
import { buildCategoryTree } from "@/lib/category-tree";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

const UNCATEGORIZED_ID = "uncategorized";

/**
 * The uncategorized queue — the pile you drag *from*, so it stays pinned beside
 * the categories rather than scrolling away as the first column of a long row.
 */
function UncategorizedPane({
  transactions,
  ...actions
}: { transactions: Transaction[] } & TileActions) {
  const { setNodeRef, isOver } = useDroppable({ id: UNCATEGORIZED_ID });
  const allSelected =
    transactions.length > 0 && transactions.every((t) => actions.selectedIds.has(t.id));

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-card md:sticky md:top-20 md:max-h-[calc(100svh-6.5rem)]",
        isOver ? "border-primary bg-primary/5" : "border-border/60",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
        {transactions.length > 0 && (
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => actions.onToggleSelectAll(transactions.map((t) => t.id))}
            aria-label="Select all uncategorized"
            className="size-3 shrink-0 cursor-pointer accent-primary"
          />
        )}
        <h3 className="min-w-0 flex-1 truncate text-xs font-semibold">Uncategorized</h3>
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
          {transactions.length}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto p-2.5">
        {transactions.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-[11px] text-muted-foreground">
            Nothing left to sort. Drop a card here to un-categorize it.
          </p>
        ) : (
          transactions.map((t) => (
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
          ))
        )}
      </div>
    </div>
  );
}

export function CategoryBoard({
  transactions,
  categories,
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
}: {
  transactions: Transaction[];
  categories: Category[];
  onCategoryChange: (id: string, categoryId: string | null) => void;
  onCategoryChangeMulti: (ids: string[], categoryId: string | null) => void;
  onTypeToggle: (id: string, currentType: Transaction["type"]) => void;
  onCardTypeToggle: (id: string, currentCardType: Transaction["card_type"]) => void;
  onNotesChange: (id: string, notes: string | null) => void;
  onDelete: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
  highlightedIds: Set<string>;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
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

  const actions: TileActions = {
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
  };

  const uncategorized = useMemo(
    () => transactions.filter((t) => !t.category_id),
    [transactions],
  );

  const tiles = useMemo(
    () =>
      buildCategoryTree(categories).map(({ parent, children }) => ({
        id: parent.id,
        title: parent.name,
        transactions: transactions.filter((t) => t.category_id === parent.id),
        subcategories: children.map((child) => ({
          id: child.id,
          title: child.name,
          transactions: transactions.filter((t) => t.category_id === child.id),
        })),
      })),
    [categories, transactions],
  );

  // With 10+ categories the grid gets tall, so let the user narrow it. Matching a
  // subcategory keeps its parent tile visible — you still need the parent's box
  // to reach the sub-slot inside it.
  const visibleTiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tiles;
    return tiles.filter(
      (tile) =>
        tile.title.toLowerCase().includes(q) ||
        tile.subcategories.some((s) => s.title.toLowerCase().includes(q)),
    );
  }, [tiles, query]);

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
      {/* Wrapping grid rather than a horizontal scroller: with 10+ categories you
          can't scroll sideways while holding a drag, so every target has to be
          reachable on screen. */}
      <div className="hidden gap-3 md:grid md:grid-cols-[19rem_minmax(0,1fr)] md:items-start">
        <UncategorizedPane transactions={uncategorized} {...actions} />

        <div className="flex flex-col gap-3">
          {tiles.length > 6 && (
            <div className="relative">
              <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter categories…"
                className="h-8 pl-8 text-xs"
              />
            </div>
          )}

          {visibleTiles.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No categories match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] items-start gap-3">
              {visibleTiles.map((tile) => (
                <CategoryTile
                  key={tile.id}
                  id={tile.id}
                  title={tile.title}
                  transactions={tile.transactions}
                  subcategories={tile.subcategories}
                  expanded={expandedIds.has(tile.id)}
                  onToggleExpanded={() => toggleExpanded(tile.id)}
                  {...actions}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </DndContext>
  );
}
