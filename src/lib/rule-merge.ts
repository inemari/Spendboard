import type { Rule, RuleCondition } from "@/lib/types";

/** Finds an existing single-condition rule in the same category with the
 * same field+operator, so new values can be folded into it instead of
 * creating a second rule for the same condition — e.g. two separate "Name
 * is exactly" rules for one category should be one rule with both values. */
export function findMergeTarget(
  rules: Rule[],
  categoryId: string,
  field: RuleCondition["field"],
  operator: string,
): Rule | undefined {
  return rules.find(
    (rule) =>
      rule.category_id === categoryId &&
      rule.conditions.length === 1 &&
      rule.conditions[0].field === field &&
      rule.conditions[0].operator === operator,
  );
}

/** Folds new values into an existing single-condition rule's value list,
 * skipping any that are already present. */
export function mergeValuesIntoRule(rule: Rule, values: string[]): RuleCondition {
  const condition = rule.conditions[0];
  const existingValues = new Set(condition.values);
  const additions = values.filter((v) => !existingValues.has(v));
  return { ...condition, values: [...condition.values, ...additions] };
}
