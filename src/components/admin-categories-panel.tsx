"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CategoryIconPicker } from "@/components/category-icon-picker";
import { CategoryCreateFields, NO_PARENT_VALUE } from "@/components/category-create-fields";
import { buildCategoryTree } from "@/lib/category-tree";
import { categorySwatch, type CategorySwatch } from "@/lib/category-colors";
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
import type { DefaultCategory } from "@/lib/types";

function DefaultSubcategoryRow({
  category,
  onRequestDelete,
}: {
  category: DefaultCategory;
  onRequestDelete: (category: DefaultCategory) => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);

  const dirty = name.trim() !== category.name && name.trim().length > 0;

  async function handleRename() {
    if (!dirty) return;
    setSaving(true);
    const { error } = await supabase
      .from("default_categories")
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
    const { error } = await supabase
      .from("default_categories")
      .update({ icon })
      .eq("id", category.id);
    if (error) {
      toast.error("Failed to change the icon.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 rounded-lg">
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
        aria-label="Delete category"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRequestDelete(category)}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function DefaultCategoryCard({
  category,
  subcategories,
  swatch,
  onAddSubcategory,
  onRequestDelete,
}: {
  category: DefaultCategory;
  subcategories: DefaultCategory[];
  swatch: CategorySwatch;
  onAddSubcategory: (parent: DefaultCategory) => void;
  onRequestDelete: (category: DefaultCategory) => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const dirty = name.trim() !== category.name && name.trim().length > 0;

  async function handleRename() {
    if (!dirty) return;
    setSaving(true);
    const { error } = await supabase
      .from("default_categories")
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
    const { error } = await supabase
      .from("default_categories")
      .update({ icon })
      .eq("id", category.id);
    if (error) {
      toast.error("Failed to change the icon.");
      return;
    }
    router.refresh();
  }

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center gap-3">
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
          aria-label={
            expanded ? "Collapse subcategories" : "Expand subcategories"
          }
          aria-expanded={expanded}
          className="shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-muted"
          onClick={() => setExpanded((v) => !v)}
        >
          <ChevronDown
            className={cn(
              "size-4 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Delete category"
          className="shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRequestDelete(category)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {subcategories.length > 0 && (
            <div className="flex flex-col gap-2 border-l-2 border-border pl-3">
              {subcategories.map((child) => (
                <DefaultSubcategoryRow
                  key={child.id}
                  category={child}
                  onRequestDelete={onRequestDelete}
                />
              ))}
            </div>
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

export function AdminCategoriesPanel({
  categories,
}: {
  categories: DefaultCategory[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState<string | null>(null);
  const [parentId, setParentId] = useState(NO_PARENT_VALUE);
  const [creating, setCreating] = useState(false);
  const newNameInputRef = useRef<HTMLInputElement>(null);
  const [pendingDelete, setPendingDelete] = useState<DefaultCategory | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<1 | 2>(1);
  const [deleting, setDeleting] = useState(false);

  const tree = buildCategoryTree(categories);
  const topLevelCategories = tree.map((g) => g.parent);
  const colorMap = useMemo(() => {
    const map = new Map<string, CategorySwatch>();
    tree.forEach(({ parent, children }, index) => {
      const swatch = categorySwatch(index);
      map.set(parent.id, swatch);
      for (const child of children) map.set(child.id, swatch);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  function openAddForm(parent?: DefaultCategory) {
    setParentId(parent ? parent.id : NO_PARENT_VALUE);
    setShowAddForm(true);
    requestAnimationFrame(() => {
      newNameInputRef.current?.focus();
      newNameInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  function closeAddForm() {
    setShowAddForm(false);
    setNewName("");
    setNewIcon(null);
    setParentId(NO_PARENT_VALUE);
  }

  function requestDelete(category: DefaultCategory) {
    setPendingDelete(category);
    setDeleteConfirmStep(1);
  }

  function dismissDelete() {
    setPendingDelete(null);
    setDeleteConfirmStep(1);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    if (deleteConfirmStep === 1) {
      setDeleteConfirmStep(2);
      return;
    }

    setDeleting(true);
    const { error } = await supabase
      .from("default_categories")
      .delete()
      .eq("id", pendingDelete.id);
    setDeleting(false);

    if (error) {
      toast.error("Failed to delete category.");
      return;
    }
    toast.success(`Deleted "${pendingDelete.name}" from the default set.`);
    dismissDelete();
    router.refresh();
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);

    const siblings = categories.filter((c) =>
      parentId === NO_PARENT_VALUE ? !c.parent_id : c.parent_id === parentId,
    );
    const nextSortOrder =
      siblings.length > 0
        ? Math.max(...siblings.map((c) => c.sort_order)) + 1
        : 0;

    const { error } = await supabase.from("default_categories").insert({
      name: newName.trim(),
      icon: newIcon,
      sort_order: nextSortOrder,
      parent_id: parentId === NO_PARENT_VALUE ? null : parentId,
    });
    setCreating(false);

    if (error) {
      toast.error("Failed to add category.");
      return;
    }
    closeAddForm();
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">
            Default categories
          </h2>
          <p className="text-sm text-muted-foreground">
            What a brand-new account starts with. Renaming, re-iconing, or
            deleting one here only affects
            <em> future</em> new accounts — it never touches a category a
            user already has.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => openAddForm()}
          className="shrink-0"
        >
          <Plus className="size-4" />
          New Category
        </Button>
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
            idPrefix="default-category"
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
            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating || !newName.trim()}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tree.map(({ parent, children }) => (
          <DefaultCategoryCard
            key={parent.id}
            category={parent}
            subcategories={children}
            swatch={colorMap.get(parent.id)!}
            onAddSubcategory={openAddForm}
            onRequestDelete={requestDelete}
          />
        ))}
      </div>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && dismissDelete()}>
        {pendingDelete && (
          <AlertDialogContent>
            {deleteConfirmStep === 1 ? (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete &ldquo;{pendingDelete.name}&rdquo; from the default set?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {pendingDelete.parent_id
                      ? "New accounts will no longer be seeded with this subcategory."
                      : "New accounts will no longer be seeded with this category" +
                        (categories.some((c) => c.parent_id === pendingDelete.id)
                          ? ", and its subcategories will be removed from the default set too."
                          : ".")}
                    {" "}This never touches a category any existing user already has.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={dismissDelete}>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => void confirmDelete()}>
                    Continue
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            ) : (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This is your second confirmation. Deleting &ldquo;{pendingDelete.name}&rdquo;
                    from the default set can&rsquo;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={dismissDelete}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={deleting}
                    onClick={() => void confirmDelete()}
                  >
                    {deleting ? "Deleting..." : "Yes, delete it"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            )}
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}
