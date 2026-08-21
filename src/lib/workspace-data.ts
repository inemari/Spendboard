import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureDefaultCategories } from "@/lib/ensure-default-categories";
import type { Category, CreditInvoice, Rule, Settlement, Transaction } from "@/lib/types";

/**
 * Categories + rules + the signed-in user, with no transactions and no
 * timeframe — what the Categories and Rules screens need, both of which are
 * account-wide and have nothing to do with dates.
 */
export async function loadCategoriesAndRules(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await ensureDefaultCategories(supabase);

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, is_default, parent_id, sort_order, icon")
    .order("sort_order")
    .order("name");

  const { data: rules, error: rulesError } = await supabase
    .from("rules")
    .select("id, category_id, created_at, conditions, type, is_default")
    .order("created_at", { ascending: false });

  return {
    userEmail: user?.email,
    categories: (categories ?? []) as Category[],
    categoriesError: categoriesError?.message ?? null,
    rules: (rules ?? []) as Rule[],
    rulesError: rulesError?.message ?? null,
  };
}

const TRANSACTION_COLUMNS =
  "id, month_id, date, description, location, notes, amount, category_id, type, card_type, credit_invoice_id";

/**
 * Transactions for a date span — the overview's only loader, covering all four
 * of its views (a month is just `resolveRange("month", …)`).
 *
 * Scoped by transaction `date`, never by `month_id`: `month_id` records which
 * month a file was *uploaded under*, so reading by it hid a statement's
 * July-dated rows on July's screen while counting them into August's total.
 */
export async function loadWorkspaceDataForRange(
  supabase: SupabaseClient,
  range: { from: string; to: string },
) {
  const shared = await loadCategoriesAndRules(supabase);

  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .gte("date", range.from)
    .lte("date", range.to);

  return {
    ...shared,
    transactions: (data ?? []) as Transaction[],
    transactionsError: error?.message ?? null,
  };
}

export type HouseholdMember = { user_id: string; default_contribution: number; email: string | null };

/**
 * The signed-in user's household (if any), its members' emails (via
 * `household_member_emails` — auth.users isn't otherwise readable), its
 * credit invoices, and its completed settlements. Returns `household: null`
 * for a user who hasn't paired up yet, which is what the Settlement screen
 * uses to show the invite/join flow instead of any of this.
 */
export async function loadHousehold(supabase: SupabaseClient) {
  const shared = await loadCategoriesAndRules(supabase);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, default_contribution")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  if (!membership) {
    return {
      ...shared,
      userId: user?.id ?? null,
      householdId: null as string | null,
      members: [] as HouseholdMember[],
      invoices: [] as CreditInvoice[],
      settlements: [] as Settlement[],
      pendingInviteCode: null as string | null,
    };
  }

  const [{ data: memberRows }, { data: emails }, { data: invoices }, { data: pendingInvite }] =
    await Promise.all([
      supabase
        .from("household_members")
        .select("user_id, default_contribution")
        .eq("household_id", membership.household_id),
      supabase.rpc("household_member_emails"),
      supabase
        .from("credit_invoices")
        .select("id, household_id, label, created_at")
        .eq("household_id", membership.household_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("household_invites")
        .select("code")
        .eq("household_id", membership.household_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .maybeSingle(),
    ]);

  const emailByUserId = new Map<string, string | null>(
    ((emails ?? []) as { user_id: string; email: string | null }[]).map((e) => [e.user_id, e.email]),
  );
  const members: HouseholdMember[] = (memberRows ?? []).map((m) => ({
    user_id: m.user_id,
    default_contribution: m.default_contribution,
    email: emailByUserId.get(m.user_id) ?? null,
  }));

  const invoiceIds = (invoices ?? []).map((i) => i.id);
  const { data: settlements } =
    invoiceIds.length > 0
      ? await supabase
          .from("settlements")
          .select(
            "id, invoice_id, status, common_total, common_share, completed_by, completed_at, settlement_members(*)",
          )
          .in("invoice_id", invoiceIds)
      : { data: [] };

  return {
    ...shared,
    userId: user?.id ?? null,
    householdId: membership.household_id as string,
    members,
    invoices: (invoices ?? []) as CreditInvoice[],
    settlements: (settlements ?? []) as Settlement[],
    pendingInviteCode: pendingInvite?.code ?? null,
  };
}

/**
 * Every transaction the user has, no timeframe at all — what the Categorize
 * screen works from. Sorting the pile is a "clear the backlog" job, not a
 * per-month one: scoping it to a month left uncategorized transactions
 * stranded on months the user had no reason to revisit.
 */
export async function loadAllTransactions(supabase: SupabaseClient) {
  const shared = await loadCategoriesAndRules(supabase);

  const { data, error } = await supabase.from("transactions").select(TRANSACTION_COLUMNS);

  return {
    ...shared,
    transactions: (data ?? []) as Transaction[],
    transactionsError: error?.message ?? null,
  };
}
