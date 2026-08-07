"use client";

import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CategoryColumn,
  type ColumnActions,
} from "@/components/category-column";
import { buildCategoryTree } from "@/lib/category-tree";
import {
  UNCATEGORIZED_SWATCH,
  type CategorySwatch,
} from "@/lib/category-colors";
import type { Category, Transaction } from "@/lib/types";

const UNCATEGORIZED_ID = "uncategorized";

// Fixed column width (+ the row's gap-3) so a step and a scroll-snap point are
// the same distance — the arrows and a manual swipe always land in sync.
// Must match the columns' actual rendered width (w-52 below) or the arrows
// overshoot past a full column, landing mid-column instead of on its edge.
const COLUMN_WIDTH = 208;
const COLUMN_GAP = 12;
const STEP = COLUMN_WIDTH + COLUMN_GAP;

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
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [query, setQuery] = useState("");
  const trackRef = useRef<HTMLDivElement>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);

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
  };

  const uncategorizedTransactions = useMemo(
    () => transactions.filter((t) => !t.category_id),
    [transactions],
  );

  const categoryColumns = useMemo(() => {
    const columns = buildCategoryTree(categories).map(({ parent, children }) => ({
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

    // Empty columns (nothing to sort or review) sink to the end of the
    // carousel — they're not what you're paging through for, so the columns
    // actually worth stepping to stay reachable in fewer steps.
    const isEmpty = (col: (typeof columns)[number]) =>
      col.transactions.length === 0 &&
      col.subcategories.every((s) => s.transactions.length === 0);
    return [...columns.filter((c) => !isEmpty(c)), ...columns.filter(isEmpty)];
  }, [transactions, categories, colorMap]);

  // Filtering steps outside the carousel entirely: matches are usually a
  // handful, so they wrap into a plain grid instead of paging through them.
  const filteredColumns = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return categoryColumns.filter(
      (col) =>
        col.title.toLowerCase().includes(q) ||
        col.subcategories.some((s) => s.title.toLowerCase().includes(q)),
    );
  }, [categoryColumns, query]);

  function step(direction: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const nextIndex = Math.max(
      0,
      Math.min(categoryColumns.length - 1, visibleIndex + direction),
    );
    track.scrollTo({ left: nextIndex * STEP, behavior: "smooth" });
    setVisibleIndex(nextIndex);
  }

  function handleTrackScroll() {
    const track = trackRef.current;
    if (!track) return;
    setVisibleIndex(Math.round(track.scrollLeft / STEP));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragEnd={handleDragEnd}
    >
      {/* Uncategorized is the pile you drag *from*, so it stays pinned and fully
          visible no matter which category column the carousel is showing —
          both ends of a drag need to be on screen at once. */}
      <div className="hidden items-start gap-3 md:flex">
        <div className="w-52 shrink-0 ">
          <CategoryColumn
            id={UNCATEGORIZED_ID}
            title="Uncategorized"
            transactions={uncategorizedTransactions}
            subcategories={[]}
            swatch={UNCATEGORIZED_SWATCH}
            emptyLabel="Nothing left to sort. Drop a card here to un-categorize it."
            bodyClassName="max-h-[calc(100svh-11rem)] "
            {...actions}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {categoryColumns.length > 6 && (
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

          {filteredColumns ? (
            filteredColumns.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                <SearchX className="size-5" />
                No categories match &ldquo;{query}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] items-start gap-3">
                {filteredColumns.map((col) => (
                  <CategoryColumn
                    key={col.id}
                    id={col.id}
                    title={col.title}
                    transactions={col.transactions}
                    subcategories={col.subcategories}
                    swatch={col.swatch}
                    {...actions}
                  />
                ))}
              </div>
            )
          ) : (
            <>
              {/* The carousel/stepper: arrows advance by exactly one column, but
                  the track is a plain scroll container underneath, so a trackpad
                  swipe or a drag near the edge works too — the arrows aren't the
                  only way through. */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => step(-1)}
                  disabled={visibleIndex === 0}
                  aria-label="Previous category"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {visibleIndex + 1} / {categoryColumns.length}
                </p>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => step(1)}
                  disabled={visibleIndex >= categoryColumns.length - 1}
                  aria-label="Next category"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div
                ref={trackRef}
                onScroll={handleTrackScroll}
                className="flex items-start snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2"
              >
                {categoryColumns.map((col) => (
                  <div key={col.id} className="w-52 shrink-0 snap-start">
                    <CategoryColumn
                      id={col.id}
                      title={col.title}
                      transactions={col.transactions}
                      subcategories={col.subcategories}
                      swatch={col.swatch}
                      {...actions}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </DndContext>
  );
}
