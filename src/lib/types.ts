export type TxType = "common" | "personal" | "need_review";
export type CardType = "regular" | "credit";

export type Category = {
  id: string;
  name: string;
  is_default: boolean;
  parent_id: string | null;
  sort_order: number;
};

export type Transaction = {
  id: string;
  month_id: string;
  date: string;
  description: string;
  location: string | null;
  notes: string | null;
  amount: number;
  category_id: string | null;
  type: TxType;
  card_type: CardType;
};

/** One field+operator with the list of values that satisfy it (OR'd). A rule
 * has at most one condition per field+operator pair — that invariant is what
 * lets the UI show one "Name Contains" section with a plain word list under
 * it, and is enforced by `findMergeTarget`/`mergeValuesIntoRule` in
 * rule-merge.ts on every write path. */
export type RuleCondition =
  | { field: "name"; operator: "equals" | "contains"; values: string[] }
  | { field: "subtitle"; operator: "contains" | "not_contains"; values: string[] };

export type Rule = {
  id: string;
  category_id: string;
  /** Conditions are AND'd together. */
  conditions: RuleCondition[];
  created_at: string;
};
