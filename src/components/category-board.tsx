"use client";

import { useLayoutEffect, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CategoryColumn } from "@/components/category-column";
import { buildCategoryTree } from "@/lib/category-tree";
import type { Category, Transaction } from "@/lib/types";

const UNCATEGORIZED_ID = "uncategorized";

// Matches CategoryColumn's expanded width (w-52) and the row's gap (gap-2),
// used once on mount to figure out how many columns fit on screen.
const COLUMN_WIDTH = 208;
const COLUMN_GAP = 8;

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
}: {
  transactions: Transaction[];
  categories: Category[];
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
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const hasSetDefaultCollapse = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
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

  // Subcategories nest inside their parent's column as sub-sections rather
  // than appearing as separate sibling columns.
  const columns = [
    {
      id: UNCATEGORIZED_ID,
      title: "Uncategorized",
      transactions: transactions.filter((t) => !t.category_id),
      subcategories: [],
    },
    ...buildCategoryTree(categories).map(({ parent, children }) => ({
      id: parent.id,
      title: parent.name,
      transactions: transactions.filter((t) => t.category_id === parent.id),
      subcategories: children.map((child) => ({
        id: child.id,
        title: child.name,
        transactions: transactions.filter((t) => t.category_id === child.id),
      })),
    })),
  ];

  // Default-collapse whatever wouldn't fit on screen anyway (the columns you'd
  // have to scroll right to reach), computed once from the actual viewport
  // width so it's never a magic column count. Runs once on mount; afterwards
  // it's entirely up to the user which columns are collapsed.
  useLayoutEffect(() => {
    if (hasSetDefaultCollapse.current || !viewportRef.current) return;
    hasSetDefaultCollapse.current = true;

    const availableWidth = viewportRef.current.clientWidth;
    const fitCount = Math.max(
      1,
      Math.floor((availableWidth + COLUMN_GAP) / (COLUMN_WIDTH + COLUMN_GAP)),
    );
    setCollapsedIds(new Set(columns.slice(fitCount).map((col) => col.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragEnd={handleDragEnd}
    >
      {/* The scrollable viewport is bounded (max-h + overflow-auto), but the
          row of columns inside it is NOT — its height is left to grow
          naturally to the tallest column's real content. A sticky header
          can never stick past the bottom of its own column box, so if that
          box were capped (and its overflow just spilling past uncontained),
          short columns would stretch to the cap while tall ones overflowed
          past it — un-sticking their headers well before the bottom of the
          actual scrollable content. Keeping the row's own height auto lets
          align-items: stretch size every column to the true tallest one, so
          headers stay stuck for the full scroll range. */}
      <div ref={viewportRef} className="hidden overflow-auto pb-2 md:block md:max-h-[90vh]">
        <div className="flex gap-2">
          {columns.map((col) => (
            <CategoryColumn
              key={col.id}
              id={col.id}
              title={col.title}
              transactions={col.transactions}
              subcategories={col.subcategories}
              categories={categories}
              onCategoryChange={onCategoryChange}
              onTypeToggle={onTypeToggle}
              onCardTypeToggle={onCardTypeToggle}
              onNotesChange={onNotesChange}
              onDelete={onDelete}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onToggleSelectAll={onToggleSelectAll}
              collapsed={collapsedIds.has(col.id)}
              onToggleCollapsed={() => toggleCollapsed(col.id)}
            />
          ))}
        </div>
      </div>
    </DndContext>
  );
}
