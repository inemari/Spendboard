import { normalizeDescription } from "@/lib/similar-transactions";
import type { Rule, RuleCondition } from "@/lib/types";

function matchesCondition(condition: RuleCondition, name: string, subtitle: string): boolean {
  const haystack = condition.field === "name" ? name : subtitle;

  return condition.values.some((raw) => {
    const value = normalizeDescription(raw);
    if (!value) return false;

    if (condition.field === "name") {
      return condition.operator === "equals" ? haystack === value : haystack.includes(value);
    }

    const contains = haystack.includes(value);
    return condition.operator === "contains" ? contains : !contains;
  });
}

function matchesRule(rule: Rule, name: string, subtitle: string): boolean {
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every((condition) => matchesCondition(condition, name, subtitle));
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
