"use client";

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CategoryColumn } from "@/components/category-column";
import { flattenWithDepth, getCategoryLabel } from "@/lib/category-tree";
import type { Category, Transaction } from "@/lib/types";

const UNCATEGORIZED_ID = "uncategorized";

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
  onCardTypeToggle: (id: string, currentCardType: Transaction["card_type"]) => void;
  onNotesChange: (id: string, notes: string | null) => void;
  onDelete: (id: string) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (ids: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

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

  const columns = [
    { id: UNCATEGORIZED_ID, name: "Uncategorized" },
    ...flattenWithDepth(categories).map(({ category: c }) => ({
      id: c.id,
      name: getCategoryLabel(c, categories),
    })),
  ];

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="hidden gap-4 overflow-x-auto pb-2 md:flex">
        {columns.map((col) => (
          <CategoryColumn
            key={col.id}
            id={col.id}
            title={col.name}
            transactions={transactions.filter(
              (t) => (t.category_id ?? UNCATEGORIZED_ID) === col.id,
            )}
            categories={categories}
            onCategoryChange={onCategoryChange}
            onTypeToggle={onTypeToggle}
            onCardTypeToggle={onCardTypeToggle}
            onNotesChange={onNotesChange}
            onDelete={onDelete}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onToggleSelectAll={onToggleSelectAll}
          />
        ))}
      </div>
    </DndContext>
  );
}
