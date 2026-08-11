import type { TxType } from "@/lib/types";

const currencyFormatter = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
});

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  day: "2-digit",
  month: "short",
});

export function formatAmount(amount: number): string {
  return currencyFormatter.format(amount);
}

export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(`${isoDate}T00:00:00`));
}

export function formatTxType(type: TxType): string {
  return type === "need_review" ? "Need review" : type[0].toUpperCase() + type.slice(1);
}

const dayHeadingFormatter = new Intl.DateTimeFormat("nb-NO", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

// Month labelling lives in date-range.ts's formatRangeLabel now — the overview
// is the only screen that names a timeframe, and it names spans, not months.

/** "torsdag 14. august" — the transaction list's day separators. */
export function formatDayHeading(isoDate: string): string {
  return dayHeadingFormatter.format(new Date(`${isoDate}T00:00:00`));
}

/**
 * Amounts are stored negative for expenses. The overview talks in spend, so it
 * needs the magnitude without the sign that would otherwise read as "minus" on
 * a figure already labelled "spent".
 */
export function formatSpend(amount: number): string {
  return currencyFormatter.format(Math.abs(amount));
}
