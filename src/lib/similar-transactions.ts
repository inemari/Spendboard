import type { Transaction } from "@/lib/types";

/** Lowercases, strips accents/digits/punctuation, and collapses whitespace, so that
 * e.g. "REMA 1000 OSLO 123" and "Rema 1000, Oslo 456" normalize to the same string. */
export function normalizeDescription(description: string): string {
  return description
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\d+/g, "")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Other transactions whose description normalizes the same as `target`'s, excluding
 * `target` itself and any already in `categoryId`. */
export function findSimilarTransactions(
  transactions: Transaction[],
  target: Transaction,
  categoryId: string | null,
): Transaction[] {
  const normalizedTarget = normalizeDescription(target.description);
  if (!normalizedTarget) return [];

  return transactions.filter(
    (t) =>
      t.id !== target.id &&
      t.category_id !== categoryId &&
      normalizeDescription(t.description) === normalizedTarget,
  );
}
