"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { SettlementReviewStep } from "@/components/settlement-review-step";
import { SettlementSummaryStep } from "@/components/settlement-summary-step";
import type { Category, Settlement, Transaction } from "@/lib/types";
import type { HouseholdMember } from "@/lib/workspace-data";

const TRANSACTION_COLUMNS =
  "id, month_id, date, description, location, notes, amount, category_id, type, card_type, credit_invoice_id";

/** Owns Step 2 ("review my transactions") vs. Step 3+4 ("settlement
 * summary") for one open (or not-yet-started) invoice. Defaults to
 * whichever step the user actually needs: straight to the summary if
 * there's nothing of theirs left to review, otherwise the review step. */
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
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"review" | "summary" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setTransactions(null);
    setError(null);

    supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("credit_invoice_id", invoiceId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setError(error.message);
          return;
        }
        setTransactions((data ?? []) as Transaction[]);
      });

    return () => {
      cancelled = true;
    };
  }, [supabase, invoiceId, reloadKey]);

  useEffect(() => {
    if (transactions !== null && step === null) {
      const hasNeedReview = transactions.some((t) => t.type === "need_review");
      setStep(hasNeedReview ? "review" : "summary");
    }
  }, [transactions, step]);

  if (error) {
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

  if (transactions === null || step === null) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading your transactions…
      </div>
    );
  }

  const hasNeedReview = transactions.some((t) => t.type === "need_review");

  return (
    <div className="flex flex-col gap-4">
      <SettlementStepper
        step={step}
        reviewDone={!hasNeedReview}
        onSelectReview={() => setStep("review")}
        onSelectSummary={() => !hasNeedReview && setStep("summary")}
      />

      {step === "review" ? (
        <SettlementReviewStep
          invoiceLabel={invoiceLabel}
          transactions={transactions}
          categories={categories}
          onConfirm={() => {
            setStep("summary");
            setReloadKey((n) => n + 1);
          }}
        />
      ) : (
        <SettlementSummaryStep
          invoiceId={invoiceId}
          userId={userId}
          members={members}
          settlement={settlement}
          onEditPersonal={() => setStep("review")}
          onEditCommon={() => setStep("review")}
          onMutated={() => router.refresh()}
        />
      )}
    </div>
  );
}

/** Orientation for a two-step flow: which step you're on, and whether the
 *  next one is reachable yet. Step 2 stays visibly disabled (not hidden)
 *  while Need-review transactions remain, so it's clear there's a next step
 *  waiting rather than the flow looking one-screen-long. */
function SettlementStepper({
  step,
  reviewDone,
  onSelectReview,
  onSelectSummary,
}: {
  step: "review" | "summary";
  reviewDone: boolean;
  onSelectReview: () => void;
  onSelectSummary: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <StepPill
        index={1}
        label="Review transactions"
        shortLabel="Review"
        active={step === "review"}
        done={reviewDone && step !== "review"}
        onClick={onSelectReview}
      />
      <div className="h-px w-4 shrink-0 bg-border" />
      <StepPill
        index={2}
        label="Settlement summary"
        shortLabel="Summary"
        active={step === "summary"}
        done={false}
        disabled={!reviewDone}
        onClick={onSelectSummary}
      />
    </div>
  );
}

function StepPill({
  index,
  label,
  shortLabel,
  active,
  done,
  disabled,
  onClick,
}: {
  index: number;
  label: string;
  shortLabel: string;
  active: boolean;
  done: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium whitespace-nowrap transition-colors",
        active && "border-primary bg-primary/10 text-primary",
        !active && !disabled && "border-border text-muted-foreground hover:bg-muted",
        disabled && "cursor-not-allowed border-border text-muted-foreground/50",
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full text-[10px]",
          active ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {done ? <Check className="size-2.5" /> : index}
      </span>
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
