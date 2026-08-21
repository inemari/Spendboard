"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CreditInvoice, Transaction } from "@/lib/types";

const NO_INVOICE_VALUE = "__no_invoice__";

/**
 * A credit transaction's settlement tag (`credit_invoice_id`), shared by the
 * overview list's expanded row and the card editor so the same eligibility
 * rule and wording can't drift between them. Renders nothing for a debit
 * transaction or a household with no invoices at all.
 *
 * Editable only while the tagged invoice (or any invoice being offered)
 * hasn't started being settled — `openInvoiceIds` is the same eligibility
 * set the upload dialog already offers. A transaction already tagged to an
 * invoice that's mid-settlement or completed shows that invoice's label
 * read-only instead, so it can't be desynced from a settlement already in
 * flight or frozen.
 */
export function SettlementTagControl({
  transaction,
  invoices,
  openInvoiceIds,
  onChange,
  className,
}: {
  transaction: Transaction;
  invoices: CreditInvoice[];
  openInvoiceIds: Set<string>;
  onChange: (invoiceId: string | null) => void;
  className?: string;
}) {
  if (transaction.card_type !== "credit" || invoices.length === 0) return null;

  const currentInvoice = transaction.credit_invoice_id
    ? invoices.find((i) => i.id === transaction.credit_invoice_id)
    : undefined;
  const isLocked =
    transaction.credit_invoice_id !== null && !openInvoiceIds.has(transaction.credit_invoice_id);

  if (isLocked) {
    return (
      <span
        className={cn(
          "rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
          className,
        )}
        title="Already part of a settlement in progress — no longer editable here"
      >
        {currentInvoice?.label ?? "Settlement"}
      </span>
    );
  }

  const assignableInvoices = invoices.filter((i) => openInvoiceIds.has(i.id));

  return (
    <Select
      value={transaction.credit_invoice_id ?? NO_INVOICE_VALUE}
      onValueChange={(value) => onChange(value === NO_INVOICE_VALUE ? null : value)}
    >
      <SelectTrigger className={className ?? "h-8 w-36 text-xs"}>
        <SelectValue>{currentInvoice?.label ?? "No settlement"}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_INVOICE_VALUE}>No settlement</SelectItem>
        {assignableInvoices.map((invoice) => (
          <SelectItem key={invoice.id} value={invoice.id}>
            {invoice.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
