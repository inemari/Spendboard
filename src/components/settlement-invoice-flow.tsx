"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { SettlementReviewStep } from "@/components/settlement-review-step";
import { SettlementSummaryStep } from "@/components/settlement-summary-step";
import type { Category, Settlement, Transaction } from "@/lib/types";
import type { HouseholdMember } from "@/lib/workspace-data";

const TRANSACTION_COLUMNS =
  "id, month_id, date, description, location, notes, amount, category_id, type, card_type, credit_invoice_id";

/** Shows the settlement summary as the invoice's home screen. Transaction
 * review is an action launched from the signed-in user's own settlement
 * card, not a peer step in a page-level workflow. */
export function SettlementInvoiceFlow({
  invoiceId,
  invoiceLabel,
  userId,
  members,
  categories,
  settlement,
}: {
  invoiceId: string;
  invoiceLabel: string;
  userId: string | null;
  members: HouseholdMember[];
  categories: Category[];
  settlement: Settlement | undefined;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [showReview, setShowReview] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const requestKey = `${invoiceId}:${reloadKey}`;
  const [transactionResult, setTransactionResult] = useState<{
    key: string;
    transactions: Transaction[] | null;
    error: string | null;
  }>({ key: requestKey, transactions: null, error: null });
  const transactions = transactionResult.key === requestKey ? transactionResult.transactions : null;
  const error = transactionResult.key === requestKey ? transactionResult.error : null;

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("credit_invoice_id", invoiceId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setTransactionResult({ key: requestKey, transactions: null, error: error.message });
          return;
        }
        setTransactionResult({
          key: requestKey,
          transactions: (data ?? []) as Transaction[],
          error: null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, invoiceId, reloadKey, requestKey]);

  if (showReview && error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center text-sm">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setReloadKey((n) => n + 1)}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (showReview && transactions === null) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading your transactions…
      </div>
    );
  }

  if (showReview && transactions) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowReview(false)}>
          <ArrowLeft />
          Back to settlement
        </Button>
        <SettlementReviewStep
          invoiceLabel={invoiceLabel}
          transactions={transactions}
          categories={categories}
          onConfirm={() => {
            setShowReview(false);
            setReloadKey((n) => n + 1);
          }}
        />
      </div>
    );
  }

  return (
    <SettlementSummaryStep
      invoiceId={invoiceId}
      userId={userId}
      members={members}
      settlement={settlement}
      onReviewTransactions={() => setShowReview(true)}
      onMutated={() => router.refresh()}
    />
  );
}
