"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Shield, Trash2, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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
import { buildCategoryTree } from "@/lib/category-tree";
import type { AppUser, DefaultCategory, RuleCondition, RuleTemplate, RuleTemplateItem } from "@/lib/types";

type MyRule = {
  id: string;
  categoryName: string;
  categoryParentName: string | null;
  conditions: RuleCondition[];
};

/** category_name/category_parent_name are the persisted values (see
 *  rule_template_items — a template targets a category by name, not id, so
 *  it stays portable across users' distinct category sets).
 *  categoryTopId/categorySubId are editor-only state resolving those names
 *  against the admin-managed default_categories list, for the cascading
 *  dropdowns below. */
type DraftItem = {
  category_name: string;
  category_parent_name: string | null;
  categoryTopId: string;
  categorySubId: string;
  conditions: RuleCondition[];
};

type EditorTarget = { mode: "create" } | { mode: "edit"; template: RuleTemplate };

/** No subcategory selected — stay at the top-level category. Distinct from
 *  categoryTopId/categorySubId both being "" (nothing chosen yet at all). */
const NO_SUBCATEGORY_VALUE = "__none__";

/** Resolves a stored category_name (+ optional category_parent_name) back to
 *  its default_categories ids, so editing an existing template item
 *  pre-selects the matching dropdowns. When a parent name is stored, it's
 *  matched first — more reliable than inferring the parent purely from
 *  which default category happens to have a same-named child, since two
 *  different parents could each have a child called the same thing. A name
 *  that doesn't match anything in the current default list (e.g. a category
 *  since renamed/removed there) leaves both ids blank, requiring the admin
 *  to re-pick — same as a brand-new item. */
function matchDefaultCategoryIds(
  defaults: DefaultCategory[],
  name: string,
  parentName: string | null,
): { topId: string; subId: string } {
  if (parentName) {
    const top = defaults.find((d) => !d.parent_id && d.name === parentName);
    if (top) {
      const child = defaults.find((d) => d.parent_id === top.id && d.name === name);
      return { topId: top.id, subId: child?.id ?? "" };
    }
    return { topId: "", subId: "" };
  }
  const top = defaults.find((d) => !d.parent_id && d.name === name);
  if (top) return { topId: top.id, subId: "" };
  const child = defaults.find((d) => d.parent_id && d.name === name);
  if (child) return { topId: child.parent_id!, subId: child.id };
  return { topId: "", subId: "" };
}

function itemsToDraft(items: RuleTemplateItem[], defaultCategories: DefaultCategory[]): DraftItem[] {
  return items.map((i) => {
    const { topId, subId } = matchDefaultCategoryIds(
      defaultCategories,
      i.category_name,
      i.category_parent_name,
    );
    return {
      category_name: i.category_name,
      category_parent_name: i.category_parent_name,
      categoryTopId: topId,
      categorySubId: subId,
      conditions: i.conditions.map((c) => ({ ...c, values: [...c.values] })),
    };
  });
}

export function AdminRulesPanel({
  templates,
  users,
  myRules,
  defaultCategories,
}: {
  templates: RuleTemplate[];
  users: AppUser[];
  myRules: MyRule[];
  defaultCategories: DefaultCategory[];
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
  const [selectedTemplateByRule, setSelectedTemplateByRule] = useState<Record<string, string>>({});
  const [copyingRuleId, setCopyingRuleId] = useState<string | null>(null);

  async function handleCopyToTemplate(rule: MyRule) {
    const templateId = selectedTemplateByRule[rule.id];
    if (!templateId) return;

    setCopyingRuleId(rule.id);
    const { error } = await supabase.from("rule_template_items").insert({
      template_id: templateId,
      category_name: rule.categoryName,
      category_parent_name: rule.categoryParentName,
      conditions: rule.conditions,
    });
    setCopyingRuleId(null);

    if (error) {
      toast.error("Failed to copy rule into template.");
      return;
    }
    toast.success(`Copied into "${templates.find((t) => t.id === templateId)?.name}".`);
    router.refresh();
  }

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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
            <Shield className="size-6 text-primary" />
            Rule templates
          </h2>
          <p className="text-sm text-muted-foreground">
            Named, reusable rule bundles. Every rule in every template is included when users
            update their admin rules, while personal rules are kept. A template can also be
            applied to an existing user on demand.
          </p>
        </div>
        <Button onClick={() => setEditorTarget({ mode: "create" })}>
          <Plus className="size-4" />
          New template
        </Button>
      </div>

      {myRules.length > 0 && (
        <div className="rounded-xl border p-4">
          <h3 className="font-semibold">Copy from your own rules</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Turn one of your personal categorization rules into a reusable template item.
          </p>
          <div className="flex flex-col gap-2">
            {myRules.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-2.5 text-sm"
              >
                <p>
                  <span className="font-medium">{rule.categoryName}</span>
                  {" — "}
                  <span className="text-muted-foreground">
                    {describeRuleConditions(rule.conditions)}
                  </span>
                </p>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={selectedTemplateByRule[rule.id]}
                    onValueChange={(value) =>
                      value && setSelectedTemplateByRule((prev) => ({ ...prev, [rule.id]: value }))
                    }
                  >
                    <SelectTrigger className="h-8 w-48 text-xs">
                      <SelectValue placeholder="Into which template…" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selectedTemplateByRule[rule.id] || copyingRuleId === rule.id}
                    onClick={() => void handleCopyToTemplate(rule)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  <h3 className="font-semibold">{template.name}</h3>
                  {template.description && (
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
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
                      <span className="font-medium">
                        {item.category_parent_name
                          ? `${item.category_parent_name} → ${item.category_name}`
                          : item.category_name}
                      </span>
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

      <TemplateEditor
        target={editorTarget}
        defaultCategories={defaultCategories}
        onClose={() => setEditorTarget(null)}
      />

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
  defaultCategories,
  onClose,
}: {
  target: EditorTarget | null;
  defaultCategories: DefaultCategory[];
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target && (
        <TemplateEditorContent
          key={target.mode === "edit" ? target.template.id : "create"}
          target={target}
          defaultCategories={defaultCategories}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function TemplateEditorContent({
  target,
  defaultCategories,
  onClose,
}: {
  target: EditorTarget;
  defaultCategories: DefaultCategory[];
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const existing = target.mode === "edit" ? target.template : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [items, setItems] = useState<DraftItem[]>(
    existing
      ? itemsToDraft(existing.items, defaultCategories)
      : [
          {
            category_name: "",
            category_parent_name: null,
            categoryTopId: "",
            categorySubId: "",
            conditions: [{ ...EMPTY_CONDITION, values: [""] }],
          },
        ],
  );
  const [saving, setSaving] = useState(false);

  const categoryTree = useMemo(() => buildCategoryTree(defaultCategories), [defaultCategories]);
  const childrenByTopId = useMemo(
    () => new Map(categoryTree.map((g) => [g.parent.id, g.children])),
    [categoryTree],
  );

  function setItemTopCategory(index: number, topId: string) {
    const topName = defaultCategories.find((d) => d.id === topId)?.name ?? "";
    setItems((prev) =>
      prev.map((it, i) =>
        i !== index
          ? it
          : {
              ...it,
              categoryTopId: topId,
              categorySubId: "",
              category_name: topName,
              category_parent_name: null,
            },
      ),
    );
  }

  function setItemSubCategory(index: number, subId: string) {
    const resolvedSubId = subId === NO_SUBCATEGORY_VALUE ? "" : subId;
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const topName = defaultCategories.find((d) => d.id === it.categoryTopId)?.name ?? "";
        const subName = resolvedSubId
          ? (defaultCategories.find((d) => d.id === resolvedSubId)?.name ?? topName)
          : topName;
        return {
          ...it,
          categorySubId: resolvedSubId,
          category_name: subName,
          category_parent_name: resolvedSubId ? topName : null,
        };
      }),
    );
  }

  function setItemConditions(index: number, conditions: RuleCondition[]) {
    setItems((prev) => prev.map((it, i) => (i !== index ? it : { ...it, conditions })));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        category_name: "",
        category_parent_name: null,
        categoryTopId: "",
        categorySubId: "",
        conditions: [{ ...EMPTY_CONDITION, values: [""] }],
      },
    ]);
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
        category_parent_name: it.category_parent_name?.trim() || null,
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
        .update({ name: name.trim(), description: description.trim() || null })
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
        .insert({ name: name.trim(), description: description.trim() || null })
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
          category_parent_name: it.category_parent_name,
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

        {items.map((item, index) => {
          const subcategories = childrenByTopId.get(item.categoryTopId) ?? [];
          return (
            <div key={index} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Select
                  value={item.categoryTopId || undefined}
                  onValueChange={(value) => value && setItemTopCategory(index, value)}
                >
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="Choose a category…">
                      {item.categoryTopId
                        ? defaultCategories.find((d) => d.id === item.categoryTopId)?.name
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categoryTree.map(({ parent }) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {subcategories.length > 0 && (
                  <Select
                    value={item.categorySubId || NO_SUBCATEGORY_VALUE}
                    onValueChange={(value) => value && setItemSubCategory(index, value)}
                  >
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue placeholder="Subcategory">
                        {item.categorySubId
                          ? defaultCategories.find((d) => d.id === item.categorySubId)?.name
                          : "General"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SUBCATEGORY_VALUE}>General (no subcategory)</SelectItem>
                      {subcategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

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
          );
        })}

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
