"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Tags } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CategoryIconPicker } from "@/components/category-icon-picker";
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
import type { DefaultCategory } from "@/lib/types";

const NO_PARENT_VALUE = "__none__";

function DefaultCategoryRow({
  category,
  indent = false,
}: {
  category: DefaultCategory;
  indent?: boolean;
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
    <div className={cn("flex items-center gap-2 rounded-lg", indent && "ml-2")}>
      <CategoryIconPicker
        value={category.icon}
        name={name}
        onChange={(icon) => void handleIconChange(icon)}
        disabled={saving}
      />
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
    </div>
  );
}

export function AdminCategoriesPanel({ categories }: { categories: DefaultCategory[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState<string | null>(null);
  const [parentId, setParentId] = useState(NO_PARENT_VALUE);
  const [creating, setCreating] = useState(false);
  const newNameInputRef = useRef<HTMLInputElement>(null);

  const tree = buildCategoryTree(categories);
  const topLevelCategories = tree.map((g) => g.parent);

  function handleAddSubcategoryClick(parent: DefaultCategory) {
    setParentId(parent.id);
    newNameInputRef.current?.focus();
    newNameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);

    const siblings = categories.filter((c) =>
      parentId === NO_PARENT_VALUE ? !c.parent_id : c.parent_id === parentId,
    );
    const nextSortOrder = siblings.length > 0 ? Math.max(...siblings.map((c) => c.sort_order)) + 1 : 0;

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
    setNewName("");
    setNewIcon(null);
    setParentId(NO_PARENT_VALUE);
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
          <Tags className="size-6 text-primary" />
          Default categories
        </h2>
        <p className="text-sm text-muted-foreground">
          What a brand-new account starts with. Renaming or re-iconing one here only affects
          <em> future</em> new accounts — it never touches categories a user already has.
          Deleting isn&rsquo;t offered here, to avoid any confusion with removing a category
          someone&rsquo;s already using.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {tree.map(({ parent, children }) => (
          <Card key={parent.id} className="p-4">
            <DefaultCategoryRow category={parent} />

            {children.length > 0 && (
              <div className="mt-2 flex flex-col gap-2 border-l-2 border-border pl-3">
                {children.map((child) => (
                  <DefaultCategoryRow key={child.id} category={child} indent />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => handleAddSubcategoryClick(parent)}
              className="mt-3 flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Add subcategory
            </button>
          </Card>
        ))}
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <h3 className="text-sm font-semibold">Add a default category</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <CategoryIconPicker value={newIcon} name={newName} onChange={setNewIcon} className="size-9" />
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
          <Button onClick={() => void handleCreate()} disabled={creating || !newName.trim()}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </Card>
    </div>
  );
}
