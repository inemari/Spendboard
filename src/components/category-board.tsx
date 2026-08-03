"use client";

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CategoryColumn } from "@/components/category-column";
import type { Category, Transaction } from "@/lib/types";

const UNCATEGORIZED_ID = "uncategorized";

export function CategoryBoard({
  transactions,
  categories,
  onCategoryChange,
  onTypeToggle,
}: {
  transactions: Transaction[];
  categories: Category[];
  onCategoryChange: (id: string, categoryId: string | null) => void;
  onTypeToggle: (id: string, currentType: Transaction["type"]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const categoryId = over.id === UNCATEGORIZED_ID ? null : String(over.id);
    onCategoryChange(String(active.id), categoryId);
  }

  const columns = [
    { id: UNCATEGORIZED_ID, name: "Uncategorized" },
    ...categories.map((c) => ({ id: c.id, name: c.name })),
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
          />
        ))}
      </div>
    </DndContext>
  );
}
