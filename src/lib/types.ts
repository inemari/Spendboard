export type TxType = "common" | "personal" | "need_review";
export type CardType = "debit" | "credit";

export type Category = {
  id: string;
  name: string;
  is_default: boolean;
  parent_id: string | null;
  sort_order: number;
  /** A slug from `src/lib/category-icons.ts`, or null to fall back to an
   *  icon guessed from the name. */
  icon: string | null;
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
  | { field: "name"; operator: "equals" | "contains" | "starts_with"; values: string[] }
  | { field: "subtitle"; operator: "contains" | "not_contains"; values: string[] };

export type Rule = {
  id: string;
  category_id: string;
  /** Conditions are AND'd together. */
  conditions: RuleCondition[];
  created_at: string;
};

/** A named, reusable bundle of rules an admin curates (`/admin/rules`) —
 * global, not tied to any one user's `rules` rows. `category_name` (not a
 * category_id) is what each item targets, since a template can be applied
 * to any user's own distinct set of categories; applying it finds-or-creates
 * a category by that name for the target user. At most one template is
 * `is_default` at a time (enforced by a DB trigger), marking which one new
 * users should receive. */
export type RuleTemplate = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_at: string;
  items: RuleTemplateItem[];
};

export type RuleTemplateItem = {
  id: string;
  template_id: string;
  category_name: string;
  conditions: RuleCondition[];
};

export type AppUser = {
  id: string;
  email: string | null;
};
