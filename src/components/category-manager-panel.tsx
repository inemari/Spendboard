"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GripVertical, Trash2 } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { buildCategoryTree } from "@/lib/category-tree";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

const NO_PARENT_VALUE = "__none__";

function SortableCategoryRow({
  category,
  indent = false,
}: {
  category: Category;
  indent?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const dirty = name.trim() !== category.name && name.trim().length > 0;

  async function handleRename() {
    if (!dirty) return;
    setSaving(true);
    const { error } = await supabase
      .from("categories")
      .update({ name: name.trim() })
      .eq("id", category.id);
    setSaving(false);

    if (error) {
      toast.error("Failed to rename category.");
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    const warning = indent
      ? `Delete "${category.name}"? Its transactions will become uncategorized.`
      : `Delete "${category.name}"? Its subcategories will be deleted too, and all their transactions will become uncategorized.`;
    if (!window.confirm(warning)) return;

    const { error } = await supabase.from("categories").delete().eq("id", category.id);

    if (error) {
      toast.error("Failed to delete category.");
      return;
    }
    toast.success(`Deleted "${category.name}".`);
    router.refresh();
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg",
        indent && "ml-2",
        isDragging && "z-10 opacity-70",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="touch-none cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        disabled={saving}
        className={cn("h-8", indent && "text-sm")}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function CategoryManagerPanel({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [items, setItems] = useState(categories);
  const [newName, setNewName] = useState("");
  const [parentId, setParentId] = useState(NO_PARENT_VALUE);
  const [creating, setCreating] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const newNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setItems(categories), [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const tree = buildCategoryTree(items);
  const topLevelCategories = tree.map((g) => g.parent);

  async function persistOrder(reordered: { id: string; sort_order: number }[]) {
    const results = await Promise.all(
      reordered.map(({ id, sort_order }) =>
        supabase.from("categories").update({ sort_order }).eq("id", id),
      ),
    );
    if (results.some((r) => r.error)) {
      toast.error("Failed to save the new order.");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeCategory = items.find((c) => c.id === active.id);
    const overCategory = items.find((c) => c.id === over.id);
    if (!activeCategory || !overCategory) return;
    if (activeCategory.parent_id !== overCategory.parent_id) return; // different group, ignore

    const siblings = items
      .filter((c) => c.parent_id === activeCategory.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const oldIndex = siblings.findIndex((c) => c.id === active.id);
    const newIndex = siblings.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(siblings, oldIndex, newIndex).map((c, i) => ({
      ...c,
      sort_order: i,
    }));

    const reorderedMap = new Map(reordered.map((c) => [c.id, c]));
    setItems((prev) => prev.map((c) => reorderedMap.get(c.id) ?? c));
    void persistOrder(reordered.map((c) => ({ id: c.id, sort_order: c.sort_order })));
  }

  function handleAddSubcategoryClick(parent: Category) {
    setParentId(parent.id);
    newNameInputRef.current?.focus();
    newNameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const siblingCount = items.filter(
      (c) => c.parent_id === (parentId === NO_PARENT_VALUE ? null : parentId),
    ).length;

    setCreating(true);
    const { error } = await supabase.from("categories").insert({
      name: trimmed,
      parent_id: parentId === NO_PARENT_VALUE ? null : parentId,
      sort_order: siblingCount,
    });
    setCreating(false);

    if (error) {
      toast.error("Failed to create category.");
      return;
    }

    setNewName("");
    setParentId(NO_PARENT_VALUE);
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">Categories</h2>
        <p className="text-sm text-muted-foreground">
          Drag the handle to reorder. Deleting a category moves its transactions back to
          Uncategorized.
        </p>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={topLevelCategories.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {tree.map(({ parent, children }) => (
              <Card key={parent.id} className="p-4">
                <SortableCategoryRow category={parent} />

                {children.length > 0 && (
                  <SortableContext
                    items={children.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="mt-2 flex flex-col gap-2 border-l-2 border-border pl-3">
                      {children.map((child) => (
                        <SortableCategoryRow key={child.id} category={child} indent />
                      ))}
                    </div>
                  </SortableContext>
                )}

                <button
                  type="button"
                  onClick={() => handleAddSubcategoryClick(parent)}
                  className="mt-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  + Add subcategory
                </button>
              </Card>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <Card className="flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold">Add a category</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            ref={newNameInputRef}
            placeholder="Category name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
            }}
            className="h-9 flex-1"
          />
          <Select value={parentId} onValueChange={(value) => setParentId(value ?? NO_PARENT_VALUE)}>
            <SelectTrigger className="h-9 sm:w-56">
              <SelectValue placeholder="Parent category">
                {parentId === NO_PARENT_VALUE
                  ? "No parent"
                  : topLevelCategories.find((c) => c.id === parentId)?.name}
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
            onClick={() => void handleCreate()}
            disabled={creating || !newName.trim()}
          >
            Add
          </Button>
        </div>
      </Card>
    </div>
  );
}
