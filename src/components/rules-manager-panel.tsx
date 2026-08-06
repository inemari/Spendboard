"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GripVertical, Pencil, Plus, Search, Trash2, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RuleEditor, type RuleEditorTarget } from "@/components/rule-editor";
import {
  ResolveRuleConflictsDialog,
  type PendingRuleConflicts,
  type RuleConflictItem,
} from "@/components/resolve-rule-conflicts-dialog";
import { describeRuleConditions } from "@/lib/rule-description";
import { flattenWithDepth } from "@/lib/category-tree";
import { ruleMatchesTransaction } from "@/lib/apply-rules";
import { cn } from "@/lib/utils";
import type { Category, Rule, RuleCondition } from "@/lib/types";

// Fixed, non-cycled-by-taste hue order for category column headers — picked
// once and assigned by position so a given category keeps its color as
// sibling categories come and go.
const CATEGORY_GRADIENTS = [
  "from-rose-200 to-pink-300",
  "from-fuchsia-200 to-purple-300",
  "from-violet-200 to-indigo-300",
  "from-sky-200 to-blue-300",
  "from-teal-200 to-emerald-300",
  "from-amber-200 to-orange-300",
];

function highlightHref(date: string, ids: string[]): string {
  const [year, month] = date.split("-").map(Number);
  return `/${year}/${month}?highlight=${ids.join(",")}`;
}

const OPERATOR_LABELS: Record<string, string> = {
  contains: "Contains",
  equals: "Equals",
  not_contains: "Doesn't contain",
};
const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  subtitle: "Subtitle",
};

type CategorySection = {
  key: string;
  categoryName: string;
  depth: number;
  unknown: boolean;
  rules: Rule[];
};

export function RulesManagerPanel({
  rules,
  categories,
}: {
  rules: Rule[];
  categories: Category[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [editorTarget, setEditorTarget] = useState<RuleEditorTarget | null>(null);
  const [query, setQuery] = useState("");
  const [pendingConflicts, setPendingConflicts] = useState<PendingRuleConflicts | null>(null);

  async function deleteRule(id: string) {
    const { error } = await supabase.from("rules").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete rule.");
      return;
    }
    toast.success("Rule deleted");
    router.refresh();
  }

  async function applyRuleToExisting(rule: Rule) {
    const { data: uncategorized, error: fetchError } = await supabase
      .from("transactions")
      .select("id, description, location, amount, date")
      .is("category_id", null);

    if (fetchError) {
      toast.error("Failed to load uncategorized transactions.");
      return;
    }

    const cleanTx: { id: string; date: string }[] = [];
    const conflicts: RuleConflictItem[] = [];

    for (const t of uncategorized ?? []) {
      const matchingRules = rules.filter((r) => ruleMatchesTransaction(r, t.description, t.location));
      if (!matchingRules.some((r) => r.id === rule.id)) continue;

      const distinctCategoryIds = Array.from(new Set(matchingRules.map((r) => r.category_id)));
      if (distinctCategoryIds.length <= 1) {
        cleanTx.push({ id: t.id, date: t.date });
        continue;
      }

      conflicts.push({
        transaction: t,
        defaultCategoryId: rule.category_id,
        options: distinctCategoryIds.map((categoryId) => ({
          categoryId,
          categoryName: categories.find((c) => c.id === categoryId)?.name ?? "Unknown category",
        })),
      });
    }

    if (cleanTx.length > 0) {
      const cleanIds = cleanTx.map((t) => t.id);
      const { error: updateError } = await supabase
        .from("transactions")
        .update({ category_id: rule.category_id })
        .in("id", cleanIds);

      if (updateError) {
        toast.error("Failed to apply rule.");
        return;
      }
      toast.success(`Categorized ${cleanIds.length} existing transaction${cleanIds.length === 1 ? "" : "s"}.`, {
        action: {
          label: "Show",
          onClick: () => router.push(highlightHref(cleanTx[0].date, cleanIds)),
        },
      });
      router.refresh();
    }

    if (conflicts.length > 0) {
      setPendingConflicts({ items: conflicts });
    } else if (cleanTx.length === 0) {
      toast.info("No uncategorized transactions match this rule.");
    }
  }

  async function resolveRuleConflicts(selections: Map<string, string>, items: RuleConflictItem[]) {
    const idsByCategory = new Map<string, string[]>();
    for (const [txId, categoryId] of selections) {
      const ids = idsByCategory.get(categoryId) ?? [];
      ids.push(txId);
      idsByCategory.set(categoryId, ids);
    }

    for (const [categoryId, ids] of idsByCategory) {
      const { error } = await supabase.from("transactions").update({ category_id: categoryId }).in("id", ids);
      if (error) {
        toast.error("Failed to apply some categorizations.");
        setPendingConflicts(null);
        router.refresh();
        return;
      }
    }

    const selectedIds = Array.from(selections.keys());
    const firstDate = items.find((item) => item.transaction.id === selectedIds[0])?.transaction.date;

    toast.success(`Categorized ${selections.size} transaction${selections.size === 1 ? "" : "s"}.`, {
      action: firstDate
        ? { label: "Show", onClick: () => router.push(highlightHref(firstDate, selectedIds)) }
        : undefined,
    });
    setPendingConflicts(null);
    router.refresh();
  }

  async function updateRuleConditions(rule: Rule, newConditions: RuleCondition[]) {
    if (newConditions.length === 0) {
      await deleteRule(rule.id);
      return;
    }

    const { error } = await supabase.from("rules").update({ conditions: newConditions }).eq("id", rule.id);

    if (error) {
      toast.error("Failed to update rule.");
      return;
    }
    router.refresh();
  }

  function removeWord(rule: Rule, conditionIndex: number, valueIndex: number) {
    const newConditions = rule.conditions
      .map((condition, ci) =>
        ci !== conditionIndex ? condition : { ...condition, values: condition.values.filter((_, vi) => vi !== valueIndex) },
      )
      .filter((condition) => condition.values.length > 0);
    void updateRuleConditions(rule, newConditions);
  }

  function updateWordValue(rule: Rule, conditionIndex: number, valueIndex: number, value: string): boolean {
    const isDuplicate = rule.conditions[conditionIndex].values.some((v, vi) => vi !== valueIndex && v === value);
    if (isDuplicate) {
      toast.error("That value is already in this condition.");
      return false;
    }
    const newConditions = rule.conditions.map((condition, ci) =>
      ci !== conditionIndex
        ? condition
        : { ...condition, values: condition.values.map((v, vi) => (vi !== valueIndex ? v : value)) },
    );
    void updateRuleConditions(rule, newConditions);
    return true;
  }

  const searchText = useMemo(() => {
    const map = new Map<string, string>();
    for (const rule of rules) {
      const category = categories.find((c) => c.id === rule.category_id);
      map.set(
        rule.id,
        `${describeRuleConditions(rule.conditions)} ${category?.name ?? "Unknown category"}`.toLowerCase(),
      );
    }
    return map;
  }, [rules, categories]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredRules =
    normalizedQuery === "" ? rules : rules.filter((rule) => searchText.get(rule.id)!.includes(normalizedQuery));

  const sections = useMemo(() => {
    const rulesByCategory = new Map<string, Rule[]>();
    for (const rule of filteredRules) {
      const siblings = rulesByCategory.get(rule.category_id) ?? [];
      siblings.push(rule);
      rulesByCategory.set(rule.category_id, siblings);
    }

    const result: CategorySection[] = [];
    for (const { category, depth } of flattenWithDepth(categories)) {
      const categoryRules = rulesByCategory.get(category.id);
      if (categoryRules?.length) {
        result.push({ key: category.id, categoryName: category.name, depth, unknown: false, rules: categoryRules });
        rulesByCategory.delete(category.id);
      }
    }
    // Whatever's left targets a category that no longer exists.
    for (const orphanedRules of rulesByCategory.values()) {
      result.push({
        key: `unknown-${orphanedRules[0].id}`,
        categoryName: "Unknown category",
        depth: 0,
        unknown: true,
        rules: orphanedRules,
      });
    }
    return result;
  }, [filteredRules, categories]);

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-bold">Rules</h2>
          <p className="text-sm text-muted-foreground">
            Rules auto-categorize matching transactions as soon as they&rsquo;re uploaded.
          </p>
        </div>
        <Button onClick={() => setEditorTarget({ mode: "create" })}>
          <Plus className="size-4" />
          Add rule
        </Button>
      </div>

      <RuleEditor
        target={editorTarget}
        categories={categories}
        existingRules={rules}
        onClose={() => setEditorTarget(null)}
      />

      <ResolveRuleConflictsDialog
        pending={pendingConflicts}
        onConfirm={(selections) => void resolveRuleConflicts(selections, pendingConflicts?.items ?? [])}
        onDismiss={() => setPendingConflicts(null)}
      />

      {rules.length > 0 && (
        <div className="relative mx-auto w-full max-w-5xl">
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rules by name, value, or category…"
            className="pl-9"
          />
        </div>
      )}

      {rules.length === 0 ? (
        <p className="mx-auto w-full max-w-5xl rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No rules yet.
        </p>
      ) : sections.length === 0 ? (
        <p className="mx-auto w-full max-w-5xl rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No rules match your search.
        </p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {sections.map((section, index) => (
            <div key={section.key} className="flex w-72 shrink-0 flex-col gap-3">
              <div
                className={cn(
                  "rounded-xl bg-linear-to-r px-4 py-2.5",
                  CATEGORY_GRADIENTS[index % CATEGORY_GRADIENTS.length],
                  section.unknown && "from-destructive/20 to-destructive/30",
                )}
              >
                <h3 className="truncate font-semibold text-foreground/90">
                  {section.depth > 0 && "↳ "}
                  {section.categoryName}
                </h3>
              </div>

              <div className="flex flex-col gap-2">
                {section.rules.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onEdit={() => setEditorTarget({ mode: "edit", rule })}
                    onDelete={() => void deleteRule(rule.id)}
                    onApplyToExisting={() => void applyRuleToExisting(rule)}
                    onValueChange={(conditionIndex, valueIndex, value) =>
                      updateWordValue(rule, conditionIndex, valueIndex, value)
                    }
                    onRemoveWord={(conditionIndex, valueIndex) => removeWord(rule, conditionIndex, valueIndex)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onApplyToExisting,
  onValueChange,
  onRemoveWord,
}: {
  rule: Rule;
  onEdit: () => void;
  onDelete: () => void;
  onApplyToExisting: () => void;
  onValueChange: (conditionIndex: number, valueIndex: number, value: string) => boolean;
  onRemoveWord: (conditionIndex: number, valueIndex: number) => void;
}) {
  return (
    <div className="group relative flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3 text-sm">
      <div className="absolute top-2 right-2 flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onApplyToExisting}
          aria-label="Apply rule to existing uncategorized transactions"
          title="Apply to existing uncategorized transactions"
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Wand2 className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label="Edit rule"
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          aria-label="Delete rule"
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </Button>
        <GripVertical className="size-4 text-muted-foreground/50" />
      </div>

      {rule.conditions.map((condition, conditionIndex) => (
        <div key={conditionIndex} className="flex flex-col gap-1.5 pr-8">
          {conditionIndex > 0 && (
            <p className="text-center text-[11px] font-semibold tracking-wide text-muted-foreground">AND</p>
          )}
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">{FIELD_LABELS[condition.field] ?? condition.field}</span>
            <Badge variant="secondary" className="font-normal">
              {OPERATOR_LABELS[condition.operator] ?? condition.operator}
            </Badge>
          </div>
          <div className="flex flex-col gap-1.5">
            {condition.values.map((value, valueIndex) => (
              <WordRow
                key={`${rule.id}-${conditionIndex}-${valueIndex}-${value}`}
                value={value}
                onValueCommit={(newValue) => onValueChange(conditionIndex, valueIndex, newValue)}
                onRemove={() => onRemoveWord(conditionIndex, valueIndex)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WordRow({
  value: initialValue,
  onValueCommit,
  onRemove,
}: {
  value: string;
  onValueCommit: (value: string) => boolean;
  onRemove: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const trimmed = value.trim();
          if (!trimmed || trimmed === initialValue) {
            setValue(initialValue);
            return;
          }
          if (!onValueCommit(trimmed)) setValue(initialValue);
        }}
        className="h-8 flex-1 text-xs"
      />

      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label="Remove word">
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
