"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { flattenWithDepth } from "@/lib/category-tree";
import { describeRule } from "@/lib/rule-description";
import type { Category, Rule, RuleCondition, RuleConditionGroup } from "@/lib/types";

export type RuleEditorTarget = { mode: "create" } | { mode: "edit"; rule: Rule };

const EMPTY_CONDITION: RuleCondition = { field: "name", operator: "equals", value: "" };

export function RuleEditor({
  target,
  categories,
  onClose,
}: {
  target: RuleEditorTarget | null;
  categories: Category[];
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target && (
        <RuleEditorContent
          key={target.mode === "edit" ? target.rule.id : "create"}
          target={target}
          categories={categories}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function RuleEditorContent({
  target,
  categories,
  onClose,
}: {
  target: RuleEditorTarget;
  categories: Category[];
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const existing = target.mode === "edit" ? target.rule : null;

  const [categoryId, setCategoryId] = useState<string | null>(existing?.category_id ?? null);
  const [groups, setGroups] = useState<RuleConditionGroup[]>(
    existing ? existing.groups.map((group) => group.map((c) => ({ ...c }))) : [[{ ...EMPTY_CONDITION }]],
  );
  const [saving, setSaving] = useState(false);

  function setConditionField(groupIndex: number, conditionIndex: number, field: RuleCondition["field"]) {
    setGroups((prev) =>
      prev.map((group, gi) =>
        gi !== groupIndex
          ? group
          : group.map((condition, ci) => {
              if (ci !== conditionIndex) return condition;
              return field === "name"
                ? { field: "name", operator: "equals", value: condition.value }
                : { field: "subtitle", operator: "contains", value: condition.value };
            }),
      ),
    );
  }

  function setConditionOperator(groupIndex: number, conditionIndex: number, operator: string) {
    setGroups((prev) =>
      prev.map((group, gi) =>
        gi !== groupIndex
          ? group
          : group.map((condition, ci) =>
              ci !== conditionIndex ? condition : ({ ...condition, operator } as RuleCondition),
            ),
      ),
    );
  }

  function setConditionValue(groupIndex: number, conditionIndex: number, value: string) {
    setGroups((prev) =>
      prev.map((group, gi) =>
        gi !== groupIndex
          ? group
          : group.map((condition, ci) => (ci !== conditionIndex ? condition : { ...condition, value })),
      ),
    );
  }

  function addConditionToGroup(groupIndex: number) {
    setGroups((prev) =>
      prev.map((group, gi) => (gi !== groupIndex ? group : [...group, { ...EMPTY_CONDITION }])),
    );
  }

  function removeCondition(groupIndex: number, conditionIndex: number) {
    setGroups((prev) =>
      prev
        .map((group, gi) => (gi !== groupIndex ? group : group.filter((_, ci) => ci !== conditionIndex)))
        .filter((group) => group.length > 0),
    );
  }

  function addGroup() {
    setGroups((prev) => [...prev, [{ ...EMPTY_CONDITION }]]);
  }

  function removeGroup(groupIndex: number) {
    setGroups((prev) => prev.filter((_, gi) => gi !== groupIndex));
  }

  async function handleSave() {
    if (!categoryId) {
      toast.error("Choose a category.");
      return;
    }

    const cleanedGroups = groups
      .map((group) =>
        group.filter((c) => c.value.trim()).map((c) => ({ ...c, value: c.value.trim() })),
      )
      .filter((group) => group.length > 0);

    if (cleanedGroups.length === 0) {
      toast.error("Add at least one condition.");
      return;
    }

    setSaving(true);
    const payload = { category_id: categoryId, conditions: cleanedGroups };
    const { error } =
      target.mode === "edit"
        ? await supabase.from("rules").update(payload).eq("id", target.rule.id)
        : await supabase.from("rules").insert(payload);
    setSaving(false);

    if (error) {
      toast.error(target.mode === "edit" ? "Failed to update rule." : "Failed to create rule.");
      return;
    }

    toast.success(target.mode === "edit" ? "Rule updated" : "Rule created");
    router.refresh();
    onClose();
  }

  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? "…";
  const previewableGroups = groups
    .map((group) => group.filter((c) => c.value.trim()))
    .filter((group) => group.length > 0);

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{target.mode === "edit" ? "Edit rule" : "Add a rule"}</DialogTitle>
        <DialogDescription>{describeRule(previewableGroups, categoryName)}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <Select value={categoryId ?? undefined} onValueChange={(value) => setCategoryId(value ?? null)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Category">{categoryId ? categoryName : undefined}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {flattenWithDepth(categories).map(({ category: c, depth }) => (
              <SelectItem key={c.id} value={c.id} className={depth > 0 ? "pl-6 text-muted-foreground" : undefined}>
                {depth > 0 ? `↳ ${c.name}` : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {groups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-2">
            {gi > 0 && (
              <p className="text-center text-xs font-semibold text-muted-foreground">AND</p>
            )}
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              {group.map((condition, ci) => (
                <div key={ci} className="flex flex-wrap items-center gap-2">
                  <Select
                    value={condition.field}
                    onValueChange={(value) =>
                      setConditionField(gi, ci, value as RuleCondition["field"])
                    }
                  >
                    <SelectTrigger className="h-8 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="subtitle">Subtitle</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.operator}
                    onValueChange={(value) => setConditionOperator(gi, ci, value ?? "")}
                  >
                    <SelectTrigger className="h-8 w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {condition.field === "name" ? (
                        <>
                          <SelectItem value="equals">Equals exactly</SelectItem>
                          <SelectItem value="contains">Contains</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="contains">Contains</SelectItem>
                          <SelectItem value="not_contains">Doesn&rsquo;t contain</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  <Input
                    value={condition.value}
                    onChange={(e) => setConditionValue(gi, ci, e.target.value)}
                    placeholder="Value"
                    className="h-8 min-w-32 flex-1 text-xs"
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeCondition(gi, ci)}
                    aria-label="Remove condition"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}

              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" size="sm" onClick={() => addConditionToGroup(gi)}>
                  <Plus className="size-3.5" />
                  Or condition
                </Button>
                {groups.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeGroup(gi)}>
                    Remove group
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" className="self-start" onClick={addGroup}>
          <Plus className="size-3.5" />
          And group
        </Button>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={saving} onClick={() => void handleSave()}>
          {target.mode === "edit" ? "Save changes" : "Create rule"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
