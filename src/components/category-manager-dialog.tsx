"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Category } from "@/lib/types";

function CategoryRow({ category }: { category: Category }) {
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
    if (!window.confirm(`Delete "${category.name}"? Its transactions will become uncategorized.`)) {
      return;
    }
    const { error } = await supabase.from("categories").delete().eq("id", category.id);

    if (error) {
      toast.error("Failed to delete category.");
      return;
    }
    toast.success(`Deleted "${category.name}".`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
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
  const [creating, setCreating] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;

    setCreating(true);
    const { error } = await supabase.from("categories").insert({ name: trimmed });
    setCreating(false);

    if (error) {
      toast.error("Failed to create category.");
      return;
    }

    setNewName("");
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
            Rename or delete categories. Deleting one moves its transactions back to
            Uncategorized.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} />
          ))}
        </div>

        <div className="flex items-center gap-2 border-t pt-4">
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
      </DialogContent>
    </Dialog>
  );
}
