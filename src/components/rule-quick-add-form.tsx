"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wand2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { flattenWithDepth } from "@/lib/category-tree";
import { findMergeTarget, mergeValuesIntoRule } from "@/lib/rule-merge";
import { RuleTypeSelect } from "@/components/rule-type-select";
import {
  FIELD_LABELS,
  OPERATOR_LABELS,
  OPERATORS_FOR_FIELD,
  defaultOperatorForField,
} from "@/lib/rule-labels";
import type { Category, Rule, RuleCondition, TxType } from "@/lib/types";

/**
 * The fast path for adding a single-condition rule, opened from the Rules
 * page's "+ New Rule" button. Multiple AND'd conditions, or changing an
 * existing rule's field/operator/category, go through the full
 * `RuleEditor` dialog instead — this form only ever creates.
 */
export function RuleQuickAddForm({
  categories,
  existingRules,
  onDone,
  onCancel,
}: {
  categories: Category[];
  existingRules: Rule[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [field, setField] = useState<RuleCondition["field"]>("name");
  const [operator, setOperator] = useState<string>(defaultOperatorForField("name"));
  const [values, setValues] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<TxType | null>(null);
  const [saving, setSaving] = useState(false);

  function changeField(next: RuleCondition["field"]) {
    setField(next);
    setOperator(defaultOperatorForField(next));
  }

  async function handleAdd() {
    if (!categoryId) {
      toast.error("Choose a category.");
      return;
    }
    if (values.length === 0) {
      toast.error("Add at least one word.");
      return;
    }

    setSaving(true);
    const condition = { field, operator, values } as RuleCondition;
    const mergeTarget = findMergeTarget(existingRules, categoryId, field, operator, type);

    const { error } = mergeTarget
      ? await supabase
          .from("rules")
          .update({ conditions: [mergeValuesIntoRule(mergeTarget, values)], is_default: false })
          .eq("id", mergeTarget.id)
      : await supabase
          .from("rules")
          .insert({ category_id: categoryId, conditions: [condition], type });
    setSaving(false);

    if (error) {
      toast.error("Failed to create rule.");
      return;
    }

    toast.success(mergeTarget ? "Merged into existing rule" : "Rule created", {
      icon: <Wand2 className="size-4" />,
    });
    router.refresh();
    onDone();
  }

  return (
    <div className="mx-auto w-full max-w-5xl rounded-xl border-2 border-primary/60 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-lg font-bold">New Rule</h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <FormField label="Field">
          <Select value={field} onValueChange={(value) => value && changeField(value as RuleCondition["field"])}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue>{FIELD_LABELS[field]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FIELD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Condition">
          <Select value={operator} onValueChange={(value) => value && setOperator(value)}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue>{OPERATOR_LABELS[operator]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {OPERATORS_FOR_FIELD[field].map((op) => (
                <SelectItem key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Words (Enter to add)">
          <WordsInput values={values} onChange={setValues} />
        </FormField>

        <FormField label="Category">
          <Select value={categoryId} onValueChange={(value) => setCategoryId(value ?? "")}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Choose…">
                {categoryId ? categories.find((c) => c.id === categoryId)?.name : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {flattenWithDepth(categories).map(({ category: c, depth }) => (
                <SelectItem key={c.id} value={c.id} className={depth > 0 ? "pl-6 text-muted-foreground" : undefined}>
                  {depth > 0 ? `↳ ${c.name}` : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Type (optional)">
          <RuleTypeSelect value={type} onChange={setType} />
        </FormField>
      </div>

      <Button className="mt-3" disabled={saving} onClick={() => void handleAdd()}>
        Add Rule
      </Button>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function WordsInput({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (values.includes(trimmed)) {
      toast.error("That value is already added.");
      setDraft("");
      return;
    }
    onChange([...values, trimmed]);
    setDraft("");
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5">
      {values.map((value) => (
        <Badge key={value} variant="secondary" className="gap-1 bg-primary/10 text-primary">
          {value}
          <button
            type="button"
            onClick={() => onChange(values.filter((v) => v !== value))}
            aria-label={`Remove ${value}`}
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          commit();
        }}
        onBlur={commit}
        placeholder={values.length === 0 ? "Add a word…" : undefined}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
