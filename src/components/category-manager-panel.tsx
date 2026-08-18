"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, GripVertical, Plus, RotateCcw, Trash2, X } from "lucide-react";
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
  rectSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { CategoryIconPicker } from "@/components/category-icon-picker";
import { CategoryCreateFields, NO_PARENT_VALUE } from "@/components/category-create-fields";
import { buildCategoryTree } from "@/lib/category-tree";
import { buildCategoryColorMap, type CategorySwatch } from "@/lib/category-colors";
import { createCategory } from "@/lib/create-category";
import { ensureDefaultCategories } from "@/lib/ensure-default-categories";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

function SubcategoryRow({
  category,
  onRequestDelete,
}: {
  category: Category;
  onRequestDelete: (category: Category, indent: boolean) => void;
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

  async function handleIconChange(icon: string | null) {
    const { error } = await supabase.from("categories").update({ icon }).eq("id", category.id);
    if (error) {
      toast.error("Failed to change the icon.");
      return;
    }
    router.refresh();
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-2 rounded-lg", isDragging && "z-10 opacity-70")}
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
      <CategoryIconPicker
        value={category.icon}
        name={name}
        onChange={(icon) => void handleIconChange(icon)}
        disabled={saving}
        className="size-7"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        disabled={saving}
        className="h-8 text-sm"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRequestDelete(category, true)}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function CategoryCard({
  category,
  subcategories,
  swatch,
  onRequestDelete,
  onAddSubcategory,
}: {
  category: Category;
  subcategories: Category[];
  swatch: CategorySwatch;
  onRequestDelete: (category: Category, indent: boolean) => void;
  onAddSubcategory: (parent: Category) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
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

  async function handleIconChange(icon: string | null) {
    const { error } = await supabase.from("categories").update({ icon }).eq("id", category.id);
    if (error) {
      toast.error("Failed to change the icon.");
      return;
    }
    router.refresh();
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("gap-3 p-4", isDragging && "z-10 opacity-70")}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="touch-none cursor-grab text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>

        <CategoryIconPicker
          value={category.icon}
          name={name}
          onChange={(icon) => void handleIconChange(icon)}
          disabled={saving}
          className={cn("size-11 rounded-full border-none", swatch.badge)}
        />

        <div className="min-w-0 flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            disabled={saving}
            className="h-auto border-none bg-transparent p-0 font-heading text-base font-semibold shadow-none focus-visible:ring-0"
          />
          <p className="text-sm text-muted-foreground">
            {subcategories.length > 0
              ? `${subcategories.length} subcategor${subcategories.length === 1 ? "y" : "ies"}`
              : "No subcategories"}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={expanded ? "Collapse subcategories" : "Expand subcategories"}
          aria-expanded={expanded}
          className="shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-muted"
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Delete category"
          className="shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRequestDelete(category, false)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {subcategories.length > 0 && (
            <SortableContext
              items={subcategories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2 border-l-2 border-border pl-3">
                {subcategories.map((child) => (
                  <SubcategoryRow
                    key={child.id}
                    category={child}
                    onRequestDelete={onRequestDelete}
                  />
                ))}
              </div>
            </SortableContext>
          )}

          <button
            type="button"
            onClick={() => onAddSubcategory(category)}
            className="flex items-center gap-1 self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            <Plus className="size-3.5" />
            Add subcategory
          </button>
        </div>
      )}
    </Card>
  );
}

export function CategoryManagerPanel({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [items, setItems] = useState(categories);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState<string | null>(null);
  const [parentId, setParentId] = useState(NO_PARENT_VALUE);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ category: Category; indent: boolean } | null>(
    null,
  );
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const newNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setItems(categories), [categories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const tree = buildCategoryTree(items);
  const topLevelCategories = tree.map((g) => g.parent);
  const colorMap = useMemo(() => buildCategoryColorMap(items), [items]);

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

  async function confirmDeleteCategory() {
    const pending = pendingDelete;
    setPendingDelete(null);
    if (!pending) return;

    const { error } = await supabase.from("categories").delete().eq("id", pending.category.id);

    if (error) {
      toast.error("Failed to delete category.");
      return;
    }
    toast.success(`Deleted "${pending.category.name}".`);
    router.refresh();
  }

  async function handleReset() {
    setResetting(true);
    // RLS's `auth.uid() = user_id` policy already scopes this to only the
    // signed-in user's own categories. Deleting them cascades: subcategories
    // go with their parent, transactions filed under a deleted category fall
    // back to uncategorized (`on delete set null`), and any rule pointing at
    // one is deleted with it (`on delete cascade`).
    const { error: deleteError } = await supabase.from("categories").delete().not("id", "is", null);
    if (deleteError) {
      setResetting(false);
      setResetConfirmOpen(false);
      toast.error("Failed to reset categories.");
      return;
    }

    // ensureDefaultCategories only seeds when the account has zero
    // categories — true here since we just deleted them all.
    await ensureDefaultCategories(supabase);

    setResetting(false);
    setResetConfirmOpen(false);
    toast.success("Categories reset to defaults.");
    router.refresh();
  }

  function openAddForm(parent?: Category) {
    setParentId(parent ? parent.id : NO_PARENT_VALUE);
    setShowAddForm(true);
    requestAnimationFrame(() => {
      newNameInputRef.current?.focus();
      newNameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function closeAddForm() {
    setShowAddForm(false);
    setNewName("");
    setNewIcon(null);
    setParentId(NO_PARENT_VALUE);
  }

  async function handleCreate() {
    if (!newName.trim()) return;

    setCreating(true);
    const { error } = await createCategory(
      supabase,
      items,
      newName,
      parentId === NO_PARENT_VALUE ? null : parentId,
      newIcon,
    );
    setCreating(false);

    if (error) {
      toast.error("Failed to create category.");
      return;
    }

    closeAddForm();
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">Categories</h2>
          <p className="text-sm text-muted-foreground">
            {items.length} categor{items.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setResetConfirmOpen(true)}>
            <RotateCcw className="size-4" />
            Reset to Defaults
          </Button>
          <Button type="button" onClick={() => openAddForm()}>
            <Plus className="size-4" />
            New Category
          </Button>
        </div>
      </div>

      {showAddForm && (
        <Card className="flex flex-col gap-3 border-primary/40 p-4 ring-1 ring-primary/20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">New Category</h3>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              onClick={closeAddForm}
            >
              <X className="size-4" />
            </Button>
          </div>
          <CategoryCreateFields
            idPrefix="category"
            icon={newIcon}
            onIconChange={setNewIcon}
            name={newName}
            onNameChange={setNewName}
            onNameEnter={() => void handleCreate()}
            nameInputRef={newNameInputRef}
            parentId={parentId}
            onParentIdChange={setParentId}
            parentOptions={topLevelCategories}
          />
          <div className="flex items-center gap-2 self-end">
            <Button type="button" variant="outline" onClick={closeAddForm}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={creating || !newName.trim()}>
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </Card>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={topLevelCategories.map((c) => c.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tree.map(({ parent, children: subcategories }) => (
              <CategoryCard
                key={parent.id}
                category={parent}
                subcategories={subcategories}
                swatch={colorMap.get(parent.id)!}
                onRequestDelete={(category, indent) => setPendingDelete({ category, indent })}
                onAddSubcategory={openAddForm}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        {pendingDelete && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{pendingDelete.category.name}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingDelete.indent
                  ? "Its transactions will become uncategorized."
                  : "Its subcategories will be deleted too, and all their transactions will become uncategorized."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => void confirmDeleteCategory()}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to default categories?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes all your current categories and subcategories, then restores the
              default set. Transactions filed under a deleted category become uncategorized, and
              any rules pointing at one are deleted too. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={resetting}
              onClick={() => void handleReset()}
            >
              {resetting ? "Resetting..." : "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
