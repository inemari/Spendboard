"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { flattenWithDepth } from "@/lib/category-tree";
import { describeRule } from "@/lib/rule-description";
import { findMergeTarget, mergeValuesIntoRule } from "@/lib/rule-merge";
import { EMPTY_CONDITION, RuleConditionsEditor } from "@/components/rule-conditions-editor";
import type { Category, Rule, RuleCondition } from "@/lib/types";

export type RuleEditorTarget = { mode: "create" } | { mode: "edit"; rule: Rule };

export function RuleEditor({
  target,
  categories,
  existingRules,
  onClose,
}: {
  target: RuleEditorTarget | null;
  categories: Category[];
  existingRules: Rule[];
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      {target && (
        <RuleEditorContent
          key={target.mode === "edit" ? target.rule.id : "create"}
          target={target}
          categories={categories}
          existingRules={existingRules}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function RuleEditorContent({
  target,
  categories,
  existingRules,
  onClose,
}: {
  target: RuleEditorTarget;
  categories: Category[];
  existingRules: Rule[];
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const existing = target.mode === "edit" ? target.rule : null;

  const [categoryId, setCategoryId] = useState<string | null>(existing?.category_id ?? null);
  const [conditions, setConditions] = useState<RuleCondition[]>(
    existing ? existing.conditions.map((c) => ({ ...c, values: [...c.values] })) : [{ ...EMPTY_CONDITION, values: [""] }],
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!categoryId) {
      toast.error("Choose a category.");
      return;
    }

    const cleanedConditions = conditions
      .map((c) => {
        const seen = new Set<string>();
        const values = c.values
          .map((v) => v.trim())
          .filter(Boolean)
          .filter((v) => {
            if (seen.has(v)) return false;
            seen.add(v);
            return true;
          });
        return { ...c, values };
      })
      .filter((c) => c.values.length > 0);

    if (cleanedConditions.length === 0) {
      toast.error("Add at least one condition.");
      return;
    }

    setSaving(true);

    // Fold into another existing rule with the same category and
    // field/operator instead of leaving two rules for the same condition,
    // when the saved rule is a single condition. On edit, this also covers
    // changing a rule's field/operator to match one that already exists —
    // the edited rule then gets folded in and removed.
    const otherRules = target.mode === "edit" ? existingRules.filter((r) => r.id !== target.rule.id) : existingRules;
    const mergeTarget =
      cleanedConditions.length === 1
        ? findMergeTarget(otherRules, categoryId, cleanedConditions[0].field, cleanedConditions[0].operator)
        : undefined;

    let error;
    if (mergeTarget) {
      ({ error } = await supabase
        .from("rules")
        .update({ conditions: [mergeValuesIntoRule(mergeTarget, cleanedConditions[0].values)] })
        .eq("id", mergeTarget.id));
      if (!error && target.mode === "edit") {
        ({ error } = await supabase.from("rules").delete().eq("id", target.rule.id));
      }
    } else if (target.mode === "edit") {
      ({ error } = await supabase
        .from("rules")
        .update({ category_id: categoryId, conditions: cleanedConditions })
        .eq("id", target.rule.id));
    } else {
      ({ error } = await supabase.from("rules").insert({ category_id: categoryId, conditions: cleanedConditions }));
    }
    setSaving(false);

    if (error) {
      toast.error(target.mode === "edit" ? "Failed to update rule." : "Failed to create rule.");
      return;
    }

    toast.success(
      mergeTarget ? "Merged into existing rule" : target.mode === "edit" ? "Rule updated" : "Rule created",
      { icon: <Wand2 className="size-4" /> },
    );
    router.refresh();
    onClose();
  }

  const categoryName = categories.find((c) => c.id === categoryId)?.name ?? "…";
  const previewableConditions = conditions
    .map((c) => ({ ...c, values: c.values.map((v) => v.trim()).filter(Boolean) }))
    .filter((c) => c.values.length > 0);

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{target.mode === "edit" ? "Edit rule" : "Add a rule"}</DialogTitle>
        <DialogDescription>{describeRule(previewableConditions, categoryName)}</DialogDescription>
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

        <RuleConditionsEditor conditions={conditions} onChange={setConditions} />
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
