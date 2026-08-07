"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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

// Base (scale === 1) grid sizing in rem — shrunk together by `scale` so the
// whole board always fits the visible viewport with no page scroll, instead
// of a fixed size that can outgrow the screen once there are enough
// categories.
const BASE_ROW_REM = 4;
const BASE_COL_MIN_REM = 6;
const MIN_SCALE = 0.4;
// No hard ceiling — a sparse range (few populated categories, mostly empty
// ones) should keep growing until it actually fills the available space,
// not stop at some arbitrary size. The attempt cap below still bounds how
// far a single measurement pass can push it.
const MAX_SCALE = Infinity;

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

  // Every empty cell gets its own full-height "Drop here" cell if rendered
  // like the populated ones — mostly whitespace once there are more than a
  // couple. Rendered as CategoryColumn's shrunk `compact` variant instead
  // (a 1x1 grid cell vs. a populated cell's 2-column/4-row span), in the
  // same grid as the populated cells with `grid-flow-row-dense` — dense
  // packing is what lets a compact cell backfill an open slot next to a
  // still-tall populated column, instead of every empty cell being pushed
  // into its own section below.
  const isPopulated = (cell: (typeof filteredCells)[number]) =>
    cell.transactions.length > 0 ||
    cell.subcategories.some((s) => s.transactions.length > 0);

  // Populated cells first (stable sort keeps each group's original order)
  // so the categories with something in them read as the front of the
  // board, with the compact empty ones trailing/backfilling around them.
  const orderedCells = useMemo(
    () =>
      [...filteredCells].sort(
        (a, b) => Number(isPopulated(b)) - Number(isPopulated(a)),
      ),
    [filteredCells],
  );

  // Grows or shrinks the grid's row height/column width together until its
  // rendered content fills (without exceeding) the space below it in the
  // viewport — so a sparse range (e.g. a single-day view with mostly empty
  // categories) uses the room it actually has instead of leaving most of the
  // screen blank, while a busy one still never needs its own page scroll.
  // Resets to 1 and re-measures from there whenever the cell list or window
  // size changes, since shrinking/growing the column width can let a
  // different number of columns fit and reflow the dense-packed layout into
  // a different number of rows — not something computable up front without
  // actually laying it out. `attemptsRef` caps how many adjustment steps run
  // per reset, so a case that can't settle within the dead zone (see below)
  // can't loop forever.
  const gridRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const cellCount = orderedCells.length;
  const attemptsRef = useRef(0);

  useEffect(() => {
    attemptsRef.current = 0;
    setScale(1);
  }, [cellCount]);

  useEffect(() => {
    function reset() {
      attemptsRef.current = 0;
      setScale(1);
    }
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || attemptsRef.current > 40) return;
    const available = window.innerHeight - grid.getBoundingClientRect().top - 16;
    const natural = grid.scrollHeight;
    // A gap between the shrink and grow thresholds (rather than both firing
    // right at 100%) keeps the two steps from fighting each other forever.
    if (natural > available && scale > MIN_SCALE) {
      attemptsRef.current += 1;
      setScale((s) => Math.max(MIN_SCALE, s * 0.92));
    } else if (natural < available * 0.92 && scale < MAX_SCALE) {
      attemptsRef.current += 1;
      setScale((s) => Math.min(MAX_SCALE, s * 1.06));
    }
  });

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
          <div
            ref={gridRef}
            className="grid grid-flow-row-dense grid-cols-[repeat(auto-fill,minmax(var(--col-min),1fr))] auto-rows-(--row-h) gap-3"
            style={
              {
                "--col-min": `${BASE_COL_MIN_REM * scale}rem`,
                "--row-h": `${BASE_ROW_REM * scale}rem`,
              } as CSSProperties
            }
          >
            {orderedCells.map((cell) => (
              <CategoryColumn
                key={cell.id}
                id={cell.id}
                title={cell.title}
                transactions={cell.transactions}
                subcategories={cell.subcategories}
                swatch={cell.swatch}
                compact={!isPopulated(cell)}
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
