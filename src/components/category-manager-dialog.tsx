"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildCategoryTree } from "@/lib/category-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

const NO_PARENT_VALUE = "__none__";

function CategoryRow({ category, indent = false }: { category: Category; indent?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [saving, setSaving] = useState(false);
  const supabase = useMemo(() => createClient(), []);

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
    <div className={cn("flex items-center gap-2", indent && "ml-6")}>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleRename}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        disabled={saving}
        className="h-8"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function CategoryManagerDialog({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [parentId, setParentId] = useState(NO_PARENT_VALUE);
  const [creating, setCreating] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const tree = buildCategoryTree(categories);
  const topLevelCategories = tree.map((g) => g.parent);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setCreating(true);
    const { error } = await supabase.from("categories").insert({
      name: trimmed,
      parent_id: parentId === NO_PARENT_VALUE ? null : parentId,
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
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Manage categories
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>
            Rename or delete categories and subcategories. Deleting one moves its
            transactions back to Uncategorized.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
          {tree.map(({ parent, children }) => (
            <div key={parent.id} className="flex flex-col gap-2">
              <CategoryRow category={parent} />
              {children.map((child) => (
                <CategoryRow key={child.id} category={child} indent />
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="New category name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
              className="h-8"
            />
            <Button
              type="button"
              size="sm"
              onClick={() => void handleCreate()}
              disabled={creating || !newName.trim()}
            >
              Add
            </Button>
          </div>

          <Select value={parentId} onValueChange={(value) => setParentId(value ?? NO_PARENT_VALUE)}>
            <SelectTrigger className="h-8 w-full text-xs">
              <SelectValue placeholder="Parent category">
                {parentId === NO_PARENT_VALUE
                  ? "No parent (top-level category)"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
