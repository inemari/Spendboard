"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
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
  backHref,
}: {
  transactions: Transaction[];
  categories: Category[];
  onCategoryChange: (id: string, categoryId: string | null) => void;
  onTypeToggle: (id: string, currentType: Transaction["type"]) => void;
  onCardTypeToggle: (id: string, currentCardType: Transaction["card_type"]) => void;
  onNotesChange: (id: string, notes: string | null) => void;
  backHref: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState(NO_PARENT_VALUE);
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

  const remaining = transactions.filter((t) => !skipped.has(t.id));
  const current = remaining[0];

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !current) return;

    onCategoryChange(String(active.id), String(over.id));
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="font-semibold">Categorize</h2>
          <p className="text-sm text-muted-foreground">
            {remaining.length} left{skipped.size > 0 ? ` · ${skipped.size} skipped` : ""}
          </p>
        </div>
        <Button variant="outline" size="sm" render={<Link href={backHref} />}>
          Done
        </Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto p-6">
          {current ? (
            <>
              <div className="w-full max-w-md">
                <DraggableTransactionCard
                  transaction={current}
                  categories={categories}
                  onCategoryChange={(categoryId) => onCategoryChange(current.id, categoryId)}
                  onTypeToggle={() => onTypeToggle(current.id, current.type)}
                  onCardTypeToggle={() => onCardTypeToggle(current.id, current.card_type)}
                  onNotesChange={(notes) => onNotesChange(current.id, notes)}
                />
              </div>

              <button
                type="button"
                onClick={() => setSkipped((prev) => new Set(prev).add(current.id))}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Skip for now
              </button>

              <div className="grid w-full max-w-5xl grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {tree.map(({ parent, children }) => (
                  <div key={parent.id} className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-2">
                    <CategoryDropZone id={parent.id} name={parent.name} variant="parent" />
                    {children.length > 0 && (
                      <div className="flex flex-col gap-1.5 pl-3">
                        {children.map((c) => (
                          <CategoryDropZone key={c.id} id={c.id} name={c.name} variant="sub" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex w-full max-w-5xl flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center">
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
                  onValueChange={(value) => setNewCategoryParentId(value ?? NO_PARENT_VALUE)}
                >
                  <SelectTrigger className="h-9 sm:w-56">
                    <SelectValue placeholder="Parent category">
                      {newCategoryParentId === NO_PARENT_VALUE
                        ? "No parent"
                        : topLevelCategories.find((c) => c.id === newCategoryParentId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PARENT_VALUE}>No parent (top-level category)</SelectItem>
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
              <p className="text-lg font-medium">
                {skipped.size > 0 ? "Everything left has been skipped." : "All caught up!"}
              </p>
              {skipped.size > 0 && (
                <Button variant="outline" onClick={() => setSkipped(new Set())}>
                  Review skipped ({skipped.size})
                </Button>
              )}
              <Button render={<Link href={backHref} />}>Back to overview</Button>
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
}
