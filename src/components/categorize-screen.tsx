"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { createCategory } from "@/lib/create-category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DraggableTransactionCard } from "@/components/draggable-transaction-card";
import { CategoryDropZone } from "@/components/category-drop-zone";
import { buildCategoryTree } from "@/lib/category-tree";
import type { Category, Transaction } from "@/lib/types";

const NO_PARENT_VALUE = "__none__";

export function CategorizeScreen({
  transactions,
  categories,
  onCategoryChange,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
  onDelete,
  backHref,
}: {
  transactions: Transaction[];
  categories: Category[];
  onCategoryChange: (id: string, categoryId: string | null) => void;
  onTypeToggle: (id: string, currentType: Transaction["type"]) => void;
  onCardTypeToggle: (
    id: string,
    currentCardType: Transaction["card_type"],
  ) => void;
  onNotesChange: (id: string, notes: string | null) => void;
  onDelete: (id: string) => void;
  backHref: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  // An index into `transactions`, not a queue — Next/Previous just move the
  // pointer, so "skip" and "go back" are the same stepper instead of two
  // separate mechanisms. Categorizing (or deleting) the current transaction
  // removes it from `transactions`, which naturally slides the next one into
  // this same index — no separate "advance" step needed.
  const [index, setIndex] = useState(0);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] =
    useState(NO_PARENT_VALUE);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const tree = buildCategoryTree(categories);
  const topLevelCategories = tree.map((g) => g.parent);

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;

    setCreatingCategory(true);
    const { error } = await createCategory(
      supabase,
      categories,
      newCategoryName,
      newCategoryParentId === NO_PARENT_VALUE ? null : newCategoryParentId,
    );
    setCreatingCategory(false);

    if (error) {
      toast.error("Failed to create category.");
      return;
    }

    setNewCategoryName("");
    setNewCategoryParentId(NO_PARENT_VALUE);
    router.refresh();
  }

  const clampedIndex =
    transactions.length === 0 ? 0 : Math.min(index, transactions.length - 1);
  const current = transactions[clampedIndex];

  function goToPrevious() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  function goToNext() {
    setIndex((i) => Math.min(i + 1, Math.max(transactions.length - 1, 0)));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !current) return;

    onCategoryChange(String(active.id), String(over.id));
  }

  return (
    <div className="flex flex-1 flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragEnd={handleDragEnd}
      >
        {" "}
        <div className="flex flex-row items-center justify-between border-b px-4 py-2">
          <div>
            <h2 className="text-sm font-semibold">Categorize</h2>
            <p className="text-xs text-muted-foreground">
              {transactions.length} uncategorized
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={backHref} />}
          >
            Done
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-4">
          {current ? (
            <>
              {/* A carousel, not a forward-only skip queue: Previous steps
                  back to a transaction you already passed, Next moves on
                  without categorizing it — same stepper either way. */}
              <div className="flex w-full max-w-sm items-center justify-between">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={goToPrevious}
                  disabled={clampedIndex === 0}
                  aria-label="Previous transaction"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {clampedIndex + 1} / {transactions.length}
                </p>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={goToNext}
                  disabled={clampedIndex === transactions.length - 1}
                  aria-label="Next transaction"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div className="w-full max-w-sm">
                <DraggableTransactionCard
                  transaction={current}
                  categories={categories}
                  onCategoryChange={(categoryId) =>
                    onCategoryChange(current.id, categoryId)
                  }
                  onTypeToggle={() => onTypeToggle(current.id, current.type)}
                  onCardTypeToggle={() =>
                    onCardTypeToggle(current.id, current.card_type)
                  }
                  onNotesChange={(notes) => onNotesChange(current.id, notes)}
                  onDelete={() => onDelete(current.id)}
                />
              </div>

              <div className="grid w-full max-w-6xl flex-1 grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-3">
                {tree.map(({ parent, children }) => (
                  <div
                    key={parent.id}
                    className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-2"
                  >
                    <CategoryDropZone
                      id={parent.id}
                      name={parent.name}
                      variant="parent"
                    />
                    {children.length > 0 && (
                      <div className="flex flex-col gap-1.5 pl-3">
                        {children.map((c) => (
                          <CategoryDropZone
                            key={c.id}
                            id={c.id}
                            name={c.name}
                            variant="sub"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex w-full max-w-5xl flex-col gap-1.5 rounded-lg border p-2 sm:flex-row sm:items-center">
                <Input
                  placeholder="New category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreateCategory();
                  }}
                  className="h-9 flex-1"
                />
                <Select
                  value={newCategoryParentId}
                  onValueChange={(value) =>
                    setNewCategoryParentId(value ?? NO_PARENT_VALUE)
                  }
                >
                  <SelectTrigger className="h-9 sm:w-56">
                    <SelectValue placeholder="Parent category">
                      {newCategoryParentId === NO_PARENT_VALUE
                        ? "No parent"
                        : topLevelCategories.find(
                            (c) => c.id === newCategoryParentId,
                          )?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARENT_VALUE}>
                      No parent (top-level category)
                    </SelectItem>
                    {topLevelCategories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        Subcategory of {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleCreateCategory()}
                  disabled={creatingCategory || !newCategoryName.trim()}
                >
                  <Plus className="size-4" />
                  Add category
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-lg font-medium">All caught up!</p>
              <Button nativeButton={false} render={<Link href={backHref} />}>
                Back to overview
              </Button>
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
}
