"use client";

import { useEffect, useState } from "react";
import { Loader2, ReceiptText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatAmount, formatDate } from "@/lib/format";
import { categoryIcon } from "@/lib/category-icons";
import type { PartnerCommonTransaction } from "@/lib/types";

/** Read-only view of a partner's Common transactions for one invoice — the
 * only place a partner's individual transaction rows are ever shown, and
 * hard-scoped to Common by household_partner_common_transactions() itself
 * (never Personal or Need review, regardless of who's asking). Modeled on
 * similar-transactions-dialog.tsx's row layout, minus the checkboxes since
 * nothing here is editable. */
export function PartnerCommonTransactionsDialog({
  open,
  onOpenChange,
  invoiceId,
  partnerUserId,
  partnerLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  partnerUserId: string;
  partnerLabel: string;
}) {
  const [rows, setRows] = useState<PartnerCommonTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRows(null);
    setError(null);

    const supabase = createClient();
    supabase
      .rpc("household_partner_common_transactions", {
        p_invoice_id: invoiceId,
        p_target_user_id: partnerUserId,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          return;
        }
        setRows((data ?? []) as PartnerCommonTransaction[]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, invoiceId, partnerUserId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{partnerLabel}&rsquo;s common transactions</DialogTitle>
          <DialogDescription>
            Read-only — {partnerLabel}&rsquo;s Personal transactions stay private.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {!error && rows === null && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading…
          </div>
        )}

        {!error && rows !== null && rows.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <ReceiptText className="size-5" />
            No common transactions on this invoice.
          </div>
        )}

        {!error && rows !== null && rows.length > 0 && (
          <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {rows.map((t) => {
              const Icon = categoryIcon(t.category_icon, t.category_name ?? undefined);
              return (
                <div key={t.id} className="flex items-start gap-3 rounded-lg border p-2 text-sm">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-3.5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium" title={t.description}>
                          {t.description}
                        </p>
                        {t.location && (
                          <p className="truncate text-xs text-muted-foreground" title={t.location}>
                            {t.location}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatAmount(t.amount)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{formatDate(t.date)}</span>
                      <span>&middot;</span>
                      <span className="truncate">{t.category_name ?? "Uncategorized"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
