"use client";

import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraggableTransactionCard } from "@/components/draggable-transaction-card";
import { CategoryDropZone } from "@/components/category-drop-zone";
import { flattenWithDepth, getCategoryLabel } from "@/lib/category-tree";
import type { Category, Transaction } from "@/lib/types";

export function ReviewMode({
  transactions,
  categories,
  onCategoryChange,
  onTypeToggle,
  onClose,
}: {
  transactions: Transaction[];
  categories: Category[];
  onCategoryChange: (id: string, categoryId: string | null) => void;
  onTypeToggle: (id: string, currentType: Transaction["type"]) => void;
  onClose: () => void;
}) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const remaining = transactions.filter((t) => !skipped.has(t.id));
  const current = remaining[0];

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !current) return;

    onCategoryChange(String(active.id), String(over.id));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="font-semibold">Review transactions</h2>
          <p className="text-sm text-muted-foreground">
            {remaining.length} left{skipped.size > 0 ? ` · ${skipped.size} skipped` : ""}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </header>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto p-6">
          {current ? (
            <>
              <div className="w-full max-w-sm">
                <DraggableTransactionCard
                  transaction={current}
                  categories={categories}
                  onCategoryChange={(categoryId) => onCategoryChange(current.id, categoryId)}
                  onTypeToggle={() => onTypeToggle(current.id, current.type)}
                />
              </div>

              <button
                type="button"
                onClick={() => setSkipped((prev) => new Set(prev).add(current.id))}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Skip for now
              </button>

              <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-3">
                {flattenWithDepth(categories).map(({ category: c }) => (
                  <CategoryDropZone key={c.id} id={c.id} name={getCategoryLabel(c, categories)} />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-lg font-medium">
                {skipped.size > 0 ? "Everything left has been skipped." : "All caught up!"}
              </p>
              {skipped.size > 0 && (
                <Button variant="outline" onClick={() => setSkipped(new Set())}>
                  Review skipped ({skipped.size})
                </Button>
              )}
              <Button onClick={onClose}>Close</Button>
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
}
