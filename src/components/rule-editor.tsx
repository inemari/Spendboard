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
import { RuleConditionsEditor } from "@/components/rule-conditions-editor";
import type { Category, Rule, RuleCondition } from "@/lib/types";

/**
 * Edit-only: creating a rule goes through the quick-add form on the Rules
 * page (`rule-quick-add-form.tsx`) instead — this dialog is for the cases
 * that form doesn't cover, multiple AND'd conditions or changing a rule's
 * field/operator/category after the fact.
 */
export function RuleEditor({
  rule,
  categories,
  existingRules,
  onClose,
}: {
  rule: Rule | null;
  categories: Category[];
  existingRules: Rule[];
  onClose: () => void;
}) {
  return (
    <Dialog open={rule !== null} onOpenChange={(open) => !open && onClose()}>
      {rule && (
        <RuleEditorContent
          key={rule.id}
          rule={rule}
          categories={categories}
          existingRules={existingRules}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function RuleEditorContent({
  rule: existing,
  categories,
  existingRules,
  onClose,
}: {
  rule: Rule;
  categories: Category[];
  existingRules: Rule[];
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [categoryId, setCategoryId] = useState<string | null>(existing.category_id);
  const [conditions, setConditions] = useState<RuleCondition[]>(
    existing.conditions.map((c) => ({ ...c, values: [...c.values] })),
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
    // when the saved rule is a single condition — this also covers changing
    // a rule's field/operator to match one that already exists, in which
    // case the edited rule gets folded in and removed.
    const otherRules = existingRules.filter((r) => r.id !== existing.id);
    const mergeTarget =
      cleanedConditions.length === 1
        ? findMergeTarget(otherRules, categoryId, cleanedConditions[0].field, cleanedConditions[0].operator)
        : undefined;

    let error;
    if (mergeTarget) {
      ({ error } = await supabase
        .from("rules")
        .update({
          conditions: [mergeValuesIntoRule(mergeTarget, cleanedConditions[0].values)],
          is_default: false,
        })
        .eq("id", mergeTarget.id));
      if (!error) {
        ({ error } = await supabase.from("rules").delete().eq("id", existing.id));
      }
    } else {
      ({ error } = await supabase
        .from("rules")
        .update({ category_id: categoryId, conditions: cleanedConditions, is_default: false })
        .eq("id", existing.id));
    }
    setSaving(false);

    if (error) {
      toast.error("Failed to update rule.");
      return;
    }

    toast.success(mergeTarget ? "Merged into existing rule" : "Rule updated", {
      icon: <Wand2 className="size-4" />,
    });
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
        <DialogTitle>Edit rule</DialogTitle>
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
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
