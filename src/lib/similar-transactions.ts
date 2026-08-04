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

const MIN_PREFIX_LENGTH = 5;

/** Other transactions whose normalized description shares `target`'s first
 * few characters, excluding `target` itself and any already in `categoryId`.
 * Deliberately loose (a shared prefix, not exact equality) so related merchant
 * names surface as candidates for the user to review rather than being missed
 * — false positives are expected to be manually rejected. */
export function findSimilarTransactions(
  transactions: Transaction[],
  target: Transaction,
  categoryId: string | null,
): Transaction[] {
  const normalizedTarget = normalizeDescription(target.description);
  if (normalizedTarget.length < MIN_PREFIX_LENGTH) return [];
  const targetPrefix = normalizedTarget.slice(0, MIN_PREFIX_LENGTH);

  return transactions.filter((t) => {
    if (t.id === target.id || t.category_id === categoryId) return false;
    const normalized = normalizeDescription(t.description);
    return normalized.length >= MIN_PREFIX_LENGTH && normalized.slice(0, MIN_PREFIX_LENGTH) === targetPrefix;
  });
}
