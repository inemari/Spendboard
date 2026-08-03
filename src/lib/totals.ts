import type { Category, Transaction } from "@/lib/types";

export function computeTotals(transactions: Transaction[], categories: Category[]) {
  const byCategory = new Map<string, number>();
  let common = 0;
  let personal = 0;
  let needReview = 0;
  let overall = 0;
  let uncategorizedCount = 0;
  let needReviewCount = 0;

  for (const t of transactions) {
    overall += t.amount;

    if (t.type === "common") common += t.amount;
    else if (t.type === "personal") personal += t.amount;
    else {
      needReview += t.amount;
      needReviewCount += 1;
    }

    if (!t.category_id) {
      uncategorizedCount += 1;
      continue;
    }
    byCategory.set(t.category_id, (byCategory.get(t.category_id) ?? 0) + t.amount);
  }

  const categoryTotals = categories.map((c) => ({
    category: c,
    total: byCategory.get(c.id) ?? 0,
  }));

  return {
    common,
    personal,
    needReview,
    overall,
    uncategorizedCount,
    needReviewCount,
    categoryTotals,
  };
}
