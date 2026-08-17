import type { RuleCondition } from "@/lib/types";

/**
 * Display labels for rule fields/operators — shared by the rule row badges
 * (`rules-manager-panel.tsx`), the full condition editor
 * (`rule-conditions-editor.tsx`), and the quick-add form
 * (`rule-quick-add-form.tsx`), so all three read identically. Labeled after
 * the product's own terminology for these columns ("description column",
 * "location column" — see CLAUDE.md's upload notes), not the raw field key.
 */
export const FIELD_LABELS: Record<RuleCondition["field"], string> = {
  name: "Description",
  subtitle: "Location",
};

export const OPERATOR_LABELS: Record<string, string> = {
  equals: "Equals",
  contains: "Contains",
  not_contains: "Doesn't contain",
  starts_with: "Starts with",
};

/** Operators allowed for each field, in display order — index 0 doubles as
 *  the default when a condition's field changes. */
export const OPERATORS_FOR_FIELD: Record<RuleCondition["field"], string[]> = {
  name: ["equals", "contains", "starts_with"],
  subtitle: ["contains", "not_contains"],
};

export function defaultOperatorForField(field: RuleCondition["field"]): string {
  return OPERATORS_FOR_FIELD[field][0];
}
