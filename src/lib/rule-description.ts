import type { RuleCondition, RuleConditionGroup } from "@/lib/types";

function describeCondition(condition: RuleCondition): string {
  if (condition.field === "name") {
    return condition.operator === "equals"
      ? `named exactly "${condition.value}"`
      : `containing "${condition.value}"`;
  }
  return condition.operator === "contains"
    ? `with a subtitle containing "${condition.value}"`
    : `with a subtitle not containing "${condition.value}"`;
}

function describeGroup(group: RuleConditionGroup): string {
  if (group.length === 0) return "";
  const parts = group.map(describeCondition);
  return parts.length > 1 ? parts.join(" or ") : parts[0];
}

/** A plain-English sentence describing what a rule does, e.g. "Transactions
 * named exactly "vitusapotek" or containing "Apotek 1", and with a subtitle
 * not containing "Berlin", are automatically moved to "Apotek"." */
export function describeRule(groups: RuleConditionGroup[], categoryName: string): string {
  const nonEmptyGroups = groups.filter((g) => g.length > 0);
  if (nonEmptyGroups.length === 0) return "This rule has no conditions yet.";

  const groupsText = nonEmptyGroups
    .map((group) => (group.length > 1 ? `(${describeGroup(group)})` : describeGroup(group)))
    .join(" and ");

  return `Transactions ${groupsText} are automatically moved to "${categoryName}".`;
}
