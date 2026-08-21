import { normalizeDescription } from "@/lib/similar-transactions";
import type { Rule, RuleCondition, TxType } from "@/lib/types";

function matchesCondition(condition: RuleCondition, name: string, subtitle: string): boolean {
  const haystack = condition.field === "name" ? name : subtitle;

  return condition.values.some((raw) => {
    const value = normalizeDescription(raw);
    if (!value) return false;

    if (condition.field === "name") {
      if (condition.operator === "equals") return haystack === value;
      if (condition.operator === "starts_with") return haystack.startsWith(value);
      return haystack.includes(value);
    }

    const contains = haystack.includes(value);
    return condition.operator === "contains" ? contains : !contains;
  });
}

function matchesRule(rule: Rule, name: string, subtitle: string): boolean {
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every((condition) => matchesCondition(condition, name, subtitle));
}

/** The single rule (if any) that governs a transaction, so category and type
 * are always read off the same match rather than searched for twice — the
 * two could otherwise disagree about which rule "won". */
export function matchingRuleFor(
  description: string,
  location: string | null,
  rules: Rule[],
): Rule | undefined {
  const name = normalizeDescription(description);
  if (!name) return undefined;
  const subtitle = location ? normalizeDescription(location) : "";

  return rules.find((rule) => matchesRule(rule, name, subtitle));
}

export function categoryIdForTransaction(
  description: string,
  location: string | null,
  rules: Rule[],
): string | null {
  return matchingRuleFor(description, location, rules)?.category_id ?? null;
}

/** The type a matching rule would also set, or null if no rule matches or
 * the matching rule doesn't set one. */
export function typeForTransaction(
  description: string,
  location: string | null,
  rules: Rule[],
): TxType | null {
  return matchingRuleFor(description, location, rules)?.type ?? null;
}

export function ruleMatchesTransaction(
  rule: Rule,
  description: string,
  location: string | null,
): boolean {
  const name = normalizeDescription(description);
  if (!name) return false;
  const subtitle = location ? normalizeDescription(location) : "";

  return matchesRule(rule, name, subtitle);
}
