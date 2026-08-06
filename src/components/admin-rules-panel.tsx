"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Shield, Star, Trash2, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EMPTY_CONDITION, RuleConditionsEditor } from "@/components/rule-conditions-editor";
import { describeRuleConditions } from "@/lib/rule-description";
import type { AppUser, RuleCondition, RuleTemplate, RuleTemplateItem } from "@/lib/types";

type DraftItem = { category_name: string; conditions: RuleCondition[] };

type EditorTarget = { mode: "create" } | { mode: "edit"; template: RuleTemplate };

function itemsToDraft(items: RuleTemplateItem[]): DraftItem[] {
  return items.map((i) => ({
    category_name: i.category_name,
    conditions: i.conditions.map((c) => ({ ...c, values: [...c.values] })),
  }));
}

export function AdminRulesPanel({
  templates,
  users,
}: {
  templates: RuleTemplate[];
  users: AppUser[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RuleTemplate | null>(null);
  const [pendingApply, setPendingApply] = useState<{ template: RuleTemplate; userId: string } | null>(
    null,
  );
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedUserByTemplate, setSelectedUserByTemplate] = useState<Record<string, string>>({});

  async function handleDelete() {
    const template = pendingDelete;
    setPendingDelete(null);
    if (!template) return;

    setDeleting(true);
    const { error } = await supabase.from("rule_templates").delete().eq("id", template.id);
    setDeleting(false);

    if (error) {
      toast.error("Failed to delete template.");
      return;
    }
    toast.success(`Deleted "${template.name}".`);
    router.refresh();
  }

  async function handleApply() {
    const pending = pendingApply;
    setPendingApply(null);
    if (!pending) return;

    setApplyingId(pending.template.id);
    const { error } = await supabase.rpc("apply_rule_template", {
      p_template_id: pending.template.id,
      target_user_id: pending.userId,
    });
    setApplyingId(null);

    if (error) {
      toast.error("Failed to apply template.");
      return;
    }
    toast.success(`Applied "${pending.template.name}".`, {
      icon: <Wand2 className="size-4" />,
    });
    router.refresh();
  }

  async function handleSetDefault(template: RuleTemplate) {
    const { error } = await supabase
      .from("rule_templates")
      .update({ is_default: !template.is_default })
      .eq("id", template.id);

    if (error) {
      toast.error("Failed to update default template.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
            <Shield className="size-6 text-primary" />
            Rule templates
          </h2>
          <p className="text-sm text-muted-foreground">
            Named, reusable rule bundles. The default one is what a brand-new user should
            receive; any template can also be applied to an existing user on demand.
          </p>
        </div>
        <Button onClick={() => setEditorTarget({ mode: "create" })}>
          <Plus className="size-4" />
          New template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <Wand2 className="size-6" />
          No templates yet.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {templates.map((template) => (
            <div key={template.id} className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{template.name}</h3>
                    {template.is_default && (
                      <Badge className="gap-1">
                        <Star className="size-3" />
                        Default
                      </Badge>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSetDefault(template)}
                  >
                    <Star className="size-3.5" />
                    {template.is_default ? "Unset default" : "Set as default"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditorTarget({ mode: "edit", template })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setPendingDelete(template)}
                    aria-label={`Delete ${template.name}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 rounded-lg bg-muted/40 p-3 text-sm">
                {template.items.length === 0 ? (
                  <p className="text-muted-foreground">No rules in this template yet.</p>
                ) : (
                  template.items.map((item) => (
                    <p key={item.id}>
                      <span className="font-medium">{item.category_name}</span>
                      {" — "}
                      <span className="text-muted-foreground">
                        {describeRuleConditions(item.conditions)}
                      </span>
                    </p>
                  ))
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={selectedUserByTemplate[template.id]}
                  onValueChange={(value) =>
                    value &&
                    setSelectedUserByTemplate((prev) => ({ ...prev, [template.id]: value }))
                  }
                >
                  <SelectTrigger className="h-8 w-56 text-xs">
                    <SelectValue placeholder="Apply to a user…" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.email ?? u.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!selectedUserByTemplate[template.id] || applyingId === template.id}
                  onClick={() =>
                    setPendingApply({ template, userId: selectedUserByTemplate[template.id] })
                  }
                >
                  {applyingId === template.id ? "Applying..." : "Apply"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateEditor target={editorTarget} onClose={() => setEditorTarget(null)} />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        {pendingDelete && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete &ldquo;{pendingDelete.name}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                This deletes the template and its rules. Users who already had this template
                applied keep the categories/rules it created for them — this only removes the
                template itself. This can&rsquo;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={deleting} onClick={() => void handleDelete()}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      <AlertDialog open={pendingApply !== null} onOpenChange={(open) => !open && setPendingApply(null)}>
        {pendingApply && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply &ldquo;{pendingApply.template.name}&rdquo;?</AlertDialogTitle>
              <AlertDialogDescription>
                Creates any of this template&rsquo;s categories that user doesn&rsquo;t already
                have, and adds its rules to their account. It won&rsquo;t remove or change
                anything they already have.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleApply()}>Apply</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}

function TemplateEditor({
  target,
  onClose,
}: {
  target: EditorTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target && (
        <TemplateEditorContent key={target.mode === "edit" ? target.template.id : "create"} target={target} onClose={onClose} />
      )}
    </Dialog>
  );
}

function TemplateEditorContent({
  target,
  onClose,
}: {
  target: EditorTarget;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const existing = target.mode === "edit" ? target.template : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isDefault, setIsDefault] = useState(existing?.is_default ?? false);
  const [items, setItems] = useState<DraftItem[]>(
    existing ? itemsToDraft(existing.items) : [{ category_name: "", conditions: [{ ...EMPTY_CONDITION, values: [""] }] }],
  );
  const [saving, setSaving] = useState(false);

  function setItemCategoryName(index: number, categoryName: string) {
    setItems((prev) => prev.map((it, i) => (i !== index ? it : { ...it, category_name: categoryName })));
  }

  function setItemConditions(index: number, conditions: RuleCondition[]) {
    setItems((prev) => prev.map((it, i) => (i !== index ? it : { ...it, conditions })));
  }

  function addItem() {
    setItems((prev) => [...prev, { category_name: "", conditions: [{ ...EMPTY_CONDITION, values: [""] }] }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name the template.");
      return;
    }

    const cleanedItems = items
      .map((it) => ({
        category_name: it.category_name.trim(),
        conditions: it.conditions
          .map((c) => ({ ...c, values: c.values.map((v) => v.trim()).filter(Boolean) }))
          .filter((c) => c.values.length > 0),
      }))
      .filter((it) => it.category_name && it.conditions.length > 0);

    if (cleanedItems.length === 0) {
      toast.error("Add at least one rule with a category name and a condition.");
      return;
    }

    setSaving(true);

    let error: string | null = null;
    let resolvedTemplateId = existing?.id;

    if (resolvedTemplateId) {
      const { error: updateError } = await supabase
        .from("rule_templates")
        .update({ name: name.trim(), description: description.trim() || null, is_default: isDefault })
        .eq("id", resolvedTemplateId);
      error = updateError?.message ?? null;

      if (!error) {
        const { error: deleteError } = await supabase
          .from("rule_template_items")
          .delete()
          .eq("template_id", resolvedTemplateId);
        error = deleteError?.message ?? null;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("rule_templates")
        .insert({ name: name.trim(), description: description.trim() || null, is_default: isDefault })
        .select("id")
        .single();
      error = insertError?.message ?? null;
      resolvedTemplateId = data?.id;
    }

    if (!error && resolvedTemplateId) {
      const { error: itemsError } = await supabase.from("rule_template_items").insert(
        cleanedItems.map((it) => ({
          template_id: resolvedTemplateId,
          category_name: it.category_name,
          conditions: it.conditions,
        })),
      );
      error = itemsError?.message ?? null;
    }

    setSaving(false);

    if (error) {
      toast.error(existing ? "Failed to update template." : "Failed to create template.");
      return;
    }

    toast.success(existing ? "Template updated" : "Template created", {
      icon: <Wand2 className="size-4" />,
    });
    router.refresh();
    onClose();
  }

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{existing ? "Edit template" : "New template"}</DialogTitle>
        <DialogDescription>
          A named bundle of rules. Each item targets a category by name — applying the
          template finds or creates that category for whichever user you apply it to.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <Input placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="size-4 accent-primary"
          />
          Default template for new users
        </label>

        {items.map((item, index) => (
          <div key={index} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Category name (e.g. Matbutikk)"
                value={item.category_name}
                onChange={(e) => setItemCategoryName(index, e.target.value)}
                className="h-8 text-xs"
              />
              {items.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeItem(index)}
                  aria-label="Remove rule"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
            <RuleConditionsEditor
              conditions={item.conditions}
              onChange={(next) => setItemConditions(index, next)}
            />
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" className="self-start" onClick={addItem}>
          <Plus className="size-3.5" />
          Add rule
        </Button>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={saving} onClick={() => void handleSave()}>
          {existing ? "Save changes" : "Create template"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
