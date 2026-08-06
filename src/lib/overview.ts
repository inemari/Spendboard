import { buildCategoryTree } from "@/lib/category-tree";
import type { Category, Transaction } from "@/lib/types";

/** How many category rows the breakdown shows before folding the tail into "Other". */
const TOP_CATEGORY_COUNT = 6;

export type CategorySlice = {
  id: string;
  name: string;
  spent: number;
  /** 0–1 of total spend, used for the bar width. */
  share: number;
  transactionCount: number;
  /** The real category ids this slice rolls up (parent + subcategories, or the
   *  whole folded tail for "Other") — what a click on this slice filters by. */
  categoryIds: string[];
};

/**
 * Spend-focused figures for the overview page.
 *
 * Deliberately separate from `computeTotals`, which nets income against
 * expenses. An overview leads with "what did I spend", so expenses (negative
 * amounts) are summed as positive magnitudes here and income is reported on its
 * own rather than quietly cancelling spend out.
 */
export function computeOverview(transactions: Transaction[], categories: Category[]) {
  let spent = 0;
  let income = 0;
  let commonSpent = 0;
  let personalSpent = 0;
  let needReviewSpent = 0;
  let needReviewCount = 0;
  let uncategorizedCount = 0;
  let uncategorizedSpent = 0;

  const spentByCategory = new Map<string, number>();
  const countByCategory = new Map<string, number>();

  for (const t of transactions) {
    if (t.amount > 0) {
      income += t.amount;
    } else {
      const magnitude = -t.amount;
      spent += magnitude;

      if (t.type === "common") commonSpent += magnitude;
      else if (t.type === "personal") personalSpent += magnitude;
      else needReviewSpent += magnitude;
    }

    if (t.type === "need_review") needReviewCount += 1;

    if (!t.category_id) {
      uncategorizedCount += 1;
      if (t.amount < 0) uncategorizedSpent += -t.amount;
      continue;
    }

    if (t.amount < 0) {
      spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? 0) + -t.amount);
    }
    countByCategory.set(t.category_id, (countByCategory.get(t.category_id) ?? 0) + 1);
  }

  // Subcategory spend rolls up into its parent. An overview wants the handful of
  // buckets you actually think in; the per-subcategory detail still lives on the
  // board and in the transaction list.
  const rolledUp: CategorySlice[] = buildCategoryTree(categories).map(({ parent, children }) => {
    const ids = [parent.id, ...children.map((c) => c.id)];
    return {
      id: parent.id,
      name: parent.name,
      spent: ids.reduce((sum, id) => sum + (spentByCategory.get(id) ?? 0), 0),
      share: 0,
      transactionCount: ids.reduce((sum, id) => sum + (countByCategory.get(id) ?? 0), 0),
      categoryIds: ids,
    };
  });

  const ranked = rolledUp.filter((slice) => slice.spent > 0).sort((a, b) => b.spent - a.spent);

  // Fold the tail rather than growing the list — a long thin tail of 1% rows is
  // noise, and the full detail is one click away on the board.
  const head = ranked.slice(0, TOP_CATEGORY_COUNT);
  const tail = ranked.slice(TOP_CATEGORY_COUNT);
  const breakdown = [...head];

  if (tail.length > 0) {
    breakdown.push({
      id: "__other__",
      name: `Other (${tail.length} categories)`,
      spent: tail.reduce((sum, slice) => sum + slice.spent, 0),
      share: 0,
      transactionCount: tail.reduce((sum, slice) => sum + slice.transactionCount, 0),
      categoryIds: tail.flatMap((slice) => slice.categoryIds),
    });
  }

  // Share is of total spend, so the bars stay comparable to the headline figure
  // even when the tail is folded or some spend is still uncategorized.
  for (const slice of breakdown) {
    slice.share = spent > 0 ? slice.spent / spent : 0;
  }

  return {
    spent,
    income,
    commonSpent,
    personalSpent,
    needReviewSpent,
    needReviewCount,
    uncategorizedCount,
    uncategorizedSpent,
    breakdown,
  };
}

export type Overview = ReturnType<typeof computeOverview>;
