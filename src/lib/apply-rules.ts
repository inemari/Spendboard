import { normalizeDescription } from "@/lib/similar-transactions";
import type { Rule, RuleCondition } from "@/lib/types";

function matchesCondition(condition: RuleCondition, name: string, subtitle: string): boolean {
  const value = normalizeDescription(condition.value);
  if (!value) return false;

  if (condition.field === "name") {
    return condition.operator === "equals" ? name === value : name.includes(value);
  }

  const contains = subtitle.includes(value);
  return condition.operator === "contains" ? contains : !contains;
}

function matchesRule(rule: Rule, name: string, subtitle: string): boolean {
  if (rule.groups.length === 0) return false;
  return rule.groups.every((group) => group.some((condition) => matchesCondition(condition, name, subtitle)));
}

export function categoryIdForTransaction(
  description: string,
  location: string | null,
  rules: Rule[],
): string | null {
  const name = normalizeDescription(description);
  if (!name) return null;
  const subtitle = location ? normalizeDescription(location) : "";

  return rules.find((rule) => matchesRule(rule, name, subtitle))?.category_id ?? null;
}
