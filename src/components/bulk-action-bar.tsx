"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { flattenWithDepth } from "@/lib/category-tree";
import { formatTxType } from "@/lib/format";
import type { Category, CardType, CreditInvoice, TxType } from "@/lib/types";

const UNCATEGORIZED_VALUE = "__uncategorized__";
const NO_INVOICE_VALUE = "__no_invoice__";
const TYPES: TxType[] = ["personal", "common", "need_review"];
const CARD_TYPES: CardType[] = ["credit", "debit"];

export function BulkActionBar({
  count,
  categories,
  openInvoices = [],
  onCategoryChange,
  onTypeChange,
  onCardTypeChange,
  onInvoiceChange,
  onDelete,
  onClear,
}: {
  count: number;
  categories: Category[];
  /** Invoices still eligible for a settlement tag — empty (and the control
   *  hidden) for a solo user with no household. */
  openInvoices?: CreditInvoice[];
  onCategoryChange: (categoryId: string | null) => void;
  onTypeChange: (type: TxType) => void;
  onCardTypeChange: (cardType: CardType) => void;
  onInvoiceChange?: (invoiceId: string | null) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="flex max-w-full flex-wrap items-center gap-x-1 gap-y-2 rounded-full border border-primary bg-card p-2 pl-4 shadow-lg">
        <span className="flex items-center gap-2 pr-2 text-sm font-semibold whitespace-nowrap">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {count}
          </span>
          selected
        </span>

        <Separator orientation="vertical" className="h-6" />

        <Select
          onValueChange={(value: string | null) =>
            onCategoryChange(value === UNCATEGORIZED_VALUE ? null : value)
          }
        >
          <SelectTrigger className="h-8 w-40 rounded-full text-xs">
            <SelectValue placeholder="Set category">
              {(value: string | null) => {
                if (!value || value === UNCATEGORIZED_VALUE)
                  return "Set category";
                return (
                  categories.find((c) => c.id === value)?.name ??
                  "Set category"
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNCATEGORIZED_VALUE}>Uncategorized</SelectItem>
            {flattenWithDepth(categories).map(({ category: c, depth }) => (
              <SelectItem
                key={c.id}
                value={c.id}
                className={
                  depth > 0 ? "pl-6 text-muted-foreground" : undefined
                }
              >
                {depth > 0 ? `↳ ${c.name}` : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Separator orientation="vertical" className="h-6" />

        <Select
          onValueChange={(value: TxType | null) => value && onTypeChange(value)}
        >
          <SelectTrigger className="h-8 w-32 rounded-full text-xs">
            <SelectValue placeholder="Set type" />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {formatTxType(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(value: CardType | null) =>
            value && onCardTypeChange(value)
          }
        >
          <SelectTrigger className="h-8 w-28 rounded-full text-xs">
            <SelectValue placeholder="Set card" />
          </SelectTrigger>
          <SelectContent>
            {CARD_TYPES.map((cardType) => (
              <SelectItem key={cardType} value={cardType} className="capitalize">
                {cardType}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {onInvoiceChange && openInvoices.length > 0 && (
          <Select
            onValueChange={(value: string | null) =>
              value && onInvoiceChange(value === NO_INVOICE_VALUE ? null : value)
            }
          >
            <SelectTrigger className="h-8 w-40 rounded-full text-xs">
              <SelectValue placeholder="Set settlement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_INVOICE_VALUE}>Remove settlement</SelectItem>
              {openInvoices.map((invoice) => (
                <SelectItem key={invoice.id} value={invoice.id}>
                  {invoice.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Separator orientation="vertical" className="h-6" />

        <Button
          size="sm"
          variant="outline"
          className="rounded-full text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>

        <Button
          size="icon"
          variant="ghost"
          className="size-8 rounded-full"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
