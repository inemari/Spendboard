"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CircleDashed,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Trash2,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { RuleEditor } from "@/components/rule-editor";
import { RuleQuickAddForm } from "@/components/rule-quick-add-form";
import {
  ResolveRuleConflictsDialog,
  type PendingRuleConflicts,
  type RuleConflictItem,
} from "@/components/resolve-rule-conflicts-dialog";
import { describeRuleConditions } from "@/lib/rule-description";
import { FIELD_LABELS, OPERATOR_LABELS } from "@/lib/rule-labels";
import { monthAnchorFor } from "@/lib/date-range";
import { flattenWithDepth } from "@/lib/category-tree";
import { ruleMatchesTransaction } from "@/lib/apply-rules";
import { buildCategoryColorMap, NEUTRAL_SWATCH, type CategorySwatch } from "@/lib/category-colors";
import { categoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import type { Category, Rule } from "@/lib/types";

/**
 * Deep-link to the overview showing the month the first affected transaction
 * falls in, with those cards ring-highlighted. Anchors the overview's `date`
 * param rather than a path segment — the overview is the only screen with a
 * timeframe, and it keeps it in the query string.
 */
function highlightHref(date: string, ids: string[]): string {
  return `/?date=${monthAnchorFor(date)}&highlight=${ids.join(",")}`;
}

type CategorySection = {
  key: string;
  categoryId: string | null;
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
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [query, setQuery] = useState("");
  const [pendingConflicts, setPendingConflicts] =
    useState<PendingRuleConflicts | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const colorMap = useMemo(() => buildCategoryColorMap(categories), [categories]);

  async function handleReset() {
    setResetting(true);
    // RLS's `auth.uid() = user_id` policy scopes this to only the
    // signed-in user's own rules.
    const { error: deleteError } = await supabase.from("rules").delete().not("id", "is", null);
    if (deleteError) {
      setResetting(false);
      setResetConfirmOpen(false);
      toast.error("Failed to reset rules.");
      return;
    }

    const { data: insertedCount, error: applyError } = await supabase.rpc(
      "apply_default_rule_template",
    );
    setResetting(false);
    setResetConfirmOpen(false);

    if (applyError) {
      toast.error("Rules cleared, but restoring the defaults failed.");
      router.refresh();
      return;
    }

    if (!insertedCount) {
      toast.info("Rules cleared. No default rule template is set up yet.");
    } else {
      toast.success(
        `Rules reset to defaults (${insertedCount} rule${insertedCount === 1 ? "" : "s"}).`,
      );
    }
    router.refresh();
  }

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
      const matchingRules = rules.filter((r) =>
        ruleMatchesTransaction(r, t.description, t.location),
      );
      if (!matchingRules.some((r) => r.id === rule.id)) continue;

      const distinctCategoryIds = Array.from(
        new Set(matchingRules.map((r) => r.category_id)),
      );
      if (distinctCategoryIds.length <= 1) {
        cleanTx.push({ id: t.id, date: t.date });
        continue;
      }

      conflicts.push({
        transaction: t,
        defaultCategoryId: rule.category_id,
        options: distinctCategoryIds.map((categoryId) => ({
          categoryId,
          categoryName:
            categories.find((c) => c.id === categoryId)?.name ??
            "Unknown category",
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
      toast.success(
        `Categorized ${cleanIds.length} existing transaction${cleanIds.length === 1 ? "" : "s"}.`,
        {
          action: {
            label: "Show",
            onClick: () =>
              router.push(highlightHref(cleanTx[0].date, cleanIds)),
          },
        },
      );
      router.refresh();
    }

    if (conflicts.length > 0) {
      setPendingConflicts({ items: conflicts });
    } else if (cleanTx.length === 0) {
      toast.info("No uncategorized transactions match this rule.");
    }
  }

  async function resolveRuleConflicts(
    selections: Map<string, string>,
    items: RuleConflictItem[],
  ) {
    const idsByCategory = new Map<string, string[]>();
    for (const [txId, categoryId] of selections) {
      const ids = idsByCategory.get(categoryId) ?? [];
      ids.push(txId);
      idsByCategory.set(categoryId, ids);
    }

    for (const [categoryId, ids] of idsByCategory) {
      const { error } = await supabase
        .from("transactions")
        .update({ category_id: categoryId })
        .in("id", ids);
      if (error) {
        toast.error("Failed to apply some categorizations.");
        setPendingConflicts(null);
        router.refresh();
        return;
      }
    }

    const selectedIds = Array.from(selections.keys());
    const firstDate = items.find(
      (item) => item.transaction.id === selectedIds[0],
    )?.transaction.date;

    toast.success(
      `Categorized ${selections.size} transaction${selections.size === 1 ? "" : "s"}.`,
      {
        action: firstDate
          ? {
              label: "Show",
              onClick: () => router.push(highlightHref(firstDate, selectedIds)),
            }
          : undefined,
      },
    );
    setPendingConflicts(null);
    router.refresh();
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
    normalizedQuery === ""
      ? rules
      : rules.filter((rule) =>
          searchText.get(rule.id)!.includes(normalizedQuery),
        );

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
        result.push({
          key: category.id,
          categoryId: category.id,
          categoryName: category.name,
          depth,
          unknown: false,
          rules: categoryRules,
        });
        rulesByCategory.delete(category.id);
      }
    }
    // Whatever's left targets a category that no longer exists.
    for (const orphanedRules of rulesByCategory.values()) {
      result.push({
        key: `unknown-${orphanedRules[0].id}`,
        categoryId: null,
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
          <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
            <Wand2 className="size-6 text-primary" />
            Rules
          </h2>
          <p className="text-sm text-muted-foreground">
            {rules.length} auto-categorization rule{rules.length === 1 ? "" : "s"}
            {rules.length > 0 && " · hover a rule to edit or re-apply"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setResetConfirmOpen(true)}>
            <RotateCcw className="size-4" />
            Reset to Defaults
          </Button>
          {!showQuickAdd && (
            <Button onClick={() => setShowQuickAdd(true)}>
              <Plus className="size-4" />
              New Rule
            </Button>
          )}
        </div>
      </div>

      {showQuickAdd && (
        <RuleQuickAddForm
          categories={categories}
          existingRules={rules}
          onDone={() => setShowQuickAdd(false)}
          onCancel={() => setShowQuickAdd(false)}
        />
      )}

      <RuleEditor
        rule={editingRule}
        categories={categories}
        existingRules={rules}
        onClose={() => setEditingRule(null)}
      />

      <ResolveRuleConflictsDialog
        pending={pendingConflicts}
        onConfirm={(selections) =>
          void resolveRuleConflicts(selections, pendingConflicts?.items ?? [])
        }
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
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <Wand2 className="size-6" />
          No rules yet.
        </div>
      ) : sections.length === 0 ? (
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <SearchX className="size-6" />
          No rules match your search.
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          {sections.map((section) => {
            const swatch = section.categoryId
              ? colorMap.get(section.categoryId) ?? NEUTRAL_SWATCH
              : NEUTRAL_SWATCH;
            const Icon = section.unknown
              ? CircleDashed
              : categoryIcon(
                  categories.find((c) => c.id === section.categoryId)?.icon,
                  section.categoryName,
                );

            return (
              <div key={section.key} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full",
                      swatch.badge,
                    )}
                  >
                    <Icon className="size-4" strokeWidth={2} />
                  </span>
                  <h3 className="font-heading text-lg font-bold">
                    {section.depth > 0 && "↳ "}
                    {section.categoryName}
                  </h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {section.rules.length}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {section.rules.map((rule) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      categoryName={section.categoryName}
                      icon={Icon}
                      swatch={swatch}
                      onEdit={() => setEditingRule(rule)}
                      onDelete={() => void deleteRule(rule.id)}
                      onApplyToExisting={() => void applyRuleToExisting(rule)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to default rules?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes all your current rules, then restores whichever rule template is set
              as the default (creating any of its categories you don&rsquo;t already have).
              Already-categorized transactions are untouched. This can&rsquo;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={resetting}
              onClick={() => void handleReset()}
            >
              {resetting ? "Resetting..." : "Reset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RuleRow({
  rule,
  categoryName,
  icon: Icon,
  swatch,
  onEdit,
  onDelete,
  onApplyToExisting,
}: {
  rule: Rule;
  categoryName: string;
  icon: LucideIcon;
  swatch: CategorySwatch;
  onEdit: () => void;
  onDelete: () => void;
  onApplyToExisting: () => void;
}) {
  return (
    <div className="group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {rule.conditions.map((condition, conditionIndex) => (
          <div key={conditionIndex} className="flex flex-wrap items-center gap-2">
            {conditionIndex > 0 && (
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">
                AND
              </span>
            )}
            <Badge className="bg-sky-100 font-medium text-sky-700">
              {FIELD_LABELS[condition.field] ?? condition.field}
            </Badge>
            <Badge className="bg-rose-100 font-medium text-rose-700">
              {OPERATOR_LABELS[condition.operator] ?? condition.operator}
            </Badge>
            <div className="flex flex-wrap gap-1.5">
              {condition.values.map((value, valueIndex) => (
                <Badge
                  key={`${conditionIndex}-${valueIndex}-${value}`}
                  variant="secondary"
                  className="bg-primary/10 font-normal text-primary"
                >
                  {value}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onApplyToExisting}
          aria-label="Apply rule to existing uncategorized transactions"
          title="Apply to existing uncategorized transactions"
        >
          <Wand2 className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Edit rule">
          <Pencil className="size-3.5" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete rule">
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className={cn("grid size-7 place-items-center rounded-full", swatch.badge)}>
          <Icon className="size-3.5" strokeWidth={2} />
        </span>
        <span className="font-semibold">{categoryName}</span>
      </div>
    </div>
  );
}
