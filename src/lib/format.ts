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
