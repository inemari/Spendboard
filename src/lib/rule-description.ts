import type { RuleCondition } from "@/lib/types";

/** One condition with its field/operator spelled out, e.g. `named exactly
 * "foo" or "bar"` — the values within a condition are OR'd. */
function describeCondition(condition: RuleCondition): string {
  const values = condition.values.map((v) => `"${v}"`).join(" or ");

  if (condition.field === "name") {
    return condition.operator === "equals" ? `named exactly ${values}` : `named containing ${values}`;
  }
  return condition.operator === "contains" ? `with a subtitle containing ${values}` : `with a subtitle not containing ${values}`;
}

/** Full sentence fragment describing a rule's conditions, e.g. `named
 * exactly "foo" or "bar" and with a subtitle not containing "baz"` —
 * conditions (different field/operator pairs) are AND'd. */
export function describeRuleConditions(conditions: RuleCondition[]): string {
  if (conditions.length === 0) return "No conditions yet";
  return conditions.map(describeCondition).join(" and ");
}

/** Full sentence describing what a rule does, e.g. `Transactions named
 * exactly "vitusapotek" or "Apotek 1" are automatically moved to
 * "Apotek".` — used in the rule editor's live preview. */
export function describeRule(conditions: RuleCondition[], categoryName: string): string {
  if (conditions.length === 0) return "This rule has no conditions yet.";
  return `Transactions ${describeRuleConditions(conditions)} are automatically moved to "${categoryName}".`;
}
