import { describe, expect, it } from "vitest";
import { matchingRuleFor } from "./apply-rules";
import type { Rule } from "./types";

const baseRule: Rule = {
  id: "rule-1",
  category_id: "category-1",
  created_at: "2026-08-21T00:00:00.000Z",
  conditions: [
    {
      field: "name",
      operator: "contains",
      values: ["kiwi"],
    },
  ],
  type: null,
  is_default: false,
};

describe("matchingRuleFor", () => {
  it("matches a valid persisted rule", () => {
    expect(matchingRuleFor("KIWI PORSGRUNN", null, [baseRule])).toBe(baseRule);
  });

  it.each([null, {}, "legacy value"])(
    "ignores a malformed persisted conditions value: %j",
    (conditions) => {
      const malformed = { ...baseRule, conditions } as unknown as Rule;

      expect(() => matchingRuleFor("KIWI PORSGRUNN", null, [malformed])).not.toThrow();
      expect(matchingRuleFor("KIWI PORSGRUNN", null, [malformed])).toBeUndefined();
    },
  );

  it("ignores a condition whose values are malformed", () => {
    const malformed = {
      ...baseRule,
      conditions: [{ field: "name", operator: "contains", values: null }],
    } as unknown as Rule;

    expect(() => matchingRuleFor("KIWI PORSGRUNN", null, [malformed])).not.toThrow();
    expect(matchingRuleFor("KIWI PORSGRUNN", null, [malformed])).toBeUndefined();
  });
});
