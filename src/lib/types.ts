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
  credit_invoice_id: string | null;
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
  /** Parent category name, one level deep, or null for a top-level
   *  category — lets apply_rule_template/apply_default_rule_template nest
   *  this item under the right parent instead of always matching top-level
   *  categories only. */
  category_parent_name: string | null;
  conditions: RuleCondition[];
};

export type AppUser = {
  id: string;
  email: string | null;
};

/** One row of the admin-managed seed list new accounts are provisioned with
 * (see ensure-default-categories.ts). Distinct from `Category` — this never
 * belongs to any one user and has no parent/subcategory concept. */
export type DefaultCategory = {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  parent_id: string | null;
};

/** A named credit-card billing period, shared at the household level (see
 * CLAUDE.md's "Shared Credit Card Settlement"). Chosen per-file at upload
 * time; distinct from `month_id`, which never crosses users. */
export type CreditInvoice = {
  id: string;
  household_id: string;
  label: string;
  created_at: string;
};

/** One row of `household_invoice_summary(invoice_id)`'s result — live,
 * sign-normalized totals for one household member on one invoice. Personal
 * totals are visible for both members (see CLAUDE.md's settlement privacy
 * notes) — only the underlying transaction rows stay private. Used only
 * while a settlement is still open; once completed, the frozen numbers come
 * from `SettlementMember` instead. */
export type InvoiceMemberSummary = {
  user_id: string;
  is_self: boolean;
  personal_total: number;
  common_total: number;
  need_review_count: number;
};

/** One `household_partner_common_transactions(...)` row — the only shape a
 * partner's individual transactions are ever exposed in: hard-filtered to
 * Common, with the owner's own category name/icon already resolved
 * server-side (a bare category_id would be unresolvable by the caller). */
export type PartnerCommonTransaction = {
  id: string;
  date: string;
  description: string;
  location: string | null;
  amount: number;
  category_name: string | null;
  category_icon: string | null;
};

export type PaymentStatus = "to_pay" | "paid";

/** One member's row in `settlement_members`. `personal_total`/`common_share`/
 * `transfer_total` stay null until the whole settlement completes (see
 * `mark_settlement_paid`); `payment_status`/`paid_at`/`contribution` are
 * mutable up until then. */
export type SettlementMember = {
  settlement_id: string;
  user_id: string;
  payment_status: PaymentStatus;
  paid_at: string | null;
  contribution: number | null;
  personal_total: number | null;
  common_share: number | null;
  transfer_total: number | null;
};

/** A settlement header for one invoice. `status` starts `'open'` the first
 * time either member marks their own transfer paid, and flips to
 * `'completed'` — once, permanently — when every member has. A completed
 * row's `common_total`/`common_share` (and every member's frozen figures in
 * `settlement_members`) are a frozen snapshot: later edits to the underlying
 * transactions never change them. */
export type Settlement = {
  id: string;
  invoice_id: string;
  status: "open" | "completed";
  common_total: number | null;
  common_share: number | null;
  completed_by: string | null;
  completed_at: string | null;
  settlement_members: SettlementMember[];
};
