"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { SettlementReviewStep } from "@/components/settlement-review-step";
import { PartnerCommonTransactionsDialog } from "@/components/partner-common-transactions-dialog";
import { HeroFigure, MiniStat } from "@/components/settlement-stat";
import { formatSpend } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, Settlement, Transaction } from "@/lib/types";
import type { HouseholdMember } from "@/lib/workspace-data";

const TRANSACTION_COLUMNS =
  "id, month_id, date, description, location, notes, amount, category_id, type, card_type, credit_invoice_id";

/** Past-tense counterpart to formatTransfer — this is a completed,
 *  historical figure, so "You're owed back" (present/future) would read
 *  oddly here. */
function transferredLabel(amount: number): { label: string; value: string } {
  if (amount < 0) return { label: "Received back", value: formatSpend(amount) };
  return { label: "Total transferred", value: formatSpend(amount) };
}

/** A completed settlement is a frozen snapshot — every figure here comes
 * straight from `settlements`/`settlement_members` (written once by
 * `mark_settlement_paid`), never recomputed from today's transactions.
 * Transactions themselves aren't locked, so this still lets the signed-in
 * user reopen their own (editable, via the same review step as the open
 * flow) and their partner's Common ones (read-only) — same privacy rules
 * as the open flow. */
export function SettlementCompletedCard({
  invoiceId,
  invoiceLabel,
  settlement,
  userId,
  members,
  categories,
}: {
  invoiceId: string;
  invoiceLabel: string;
  settlement: Settlement;
  userId: string | null;
  members: HouseholdMember[];
  categories: Category[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [showOwn, setShowOwn] = useState(false);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);

  useEffect(() => {
    if (!showOwn) return;
    supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("credit_invoice_id", invoiceId)
      .then(({ data }) => setTransactions((data ?? []) as Transaction[]));
  }, [showOwn, supabase, invoiceId]);

  const mine = settlement.settlement_members.find((m) => m.user_id === userId);
  const partnerSettlementMember = settlement.settlement_members.find((m) => m.user_id !== userId);
  const partnerMember = members.find((m) => m.user_id === partnerSettlementMember?.user_id);
  const partnerLabel = partnerMember?.email ?? "your partner";

  if (showOwn) {
    return (
      <div className="flex flex-col gap-4">
        {transactions === null ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <SettlementReviewStep
            invoiceLabel={invoiceLabel}
            transactions={transactions}
            categories={categories}
            onConfirm={() => setShowOwn(false)}
          />
        )}
        <Button variant="outline" size="sm" className="self-start" onClick={() => setShowOwn(false)}>
          Back to summary
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PartyPopper className="size-4 text-primary" />
          {invoiceLabel} — settled
        </CardTitle>
        <CardDescription>
          Completed {settlement.completed_at ? new Date(settlement.completed_at).toLocaleDateString() : ""}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          Total Common {formatSpend(settlement.common_total ?? 0)} → {formatSpend(settlement.common_share ?? 0)} each
        </p>

        {/* Your section — primary focus, same shape as the open-invoice
            summary step: a hero transfer figure, then Personal/Common
            share/Contribution as an equal-weight supporting row. */}
        <div className="flex flex-col gap-3 rounded-xl border-2 border-primary/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">You</p>
            <Badge variant="default">Paid</Badge>
          </div>
          <HeroFigure icon={Banknote} size="lg" {...transferredLabel(mine?.transfer_total ?? 0)} />
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-primary/5 p-3">
            <MiniStat label="Personal" dotClassName="bg-chart-2" value={formatSpend(mine?.personal_total ?? 0)} />
            <MiniStat label="Common share" dotClassName="bg-chart-1" value={formatSpend(mine?.common_share ?? 0)} />
            <MiniStat label="Contribution" value={formatSpend(mine?.contribution ?? 0)} />
          </div>
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setShowOwn(true)}>
            View &amp; edit your transactions
          </Button>
        </div>

        {/* Partner's section — same shape, deliberately quieter/smaller. */}
        <div className={cn("flex flex-col gap-3 rounded-xl border border-secondary/25 p-3")}>
          <div className="flex items-center justify-between gap-2">
            <p className="wrap-break-word text-sm text-muted-foreground">{partnerLabel}</p>
            <Badge variant="default">Paid</Badge>
          </div>
          <HeroFigure icon={Banknote} size="sm" {...transferredLabel(partnerSettlementMember?.transfer_total ?? 0)} />
          <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/50 p-2.5">
            <MiniStat
              label="Personal"
              dotClassName="bg-chart-2"
              value={formatSpend(partnerSettlementMember?.personal_total ?? 0)}
            />
            <MiniStat
              label="Common share"
              dotClassName="bg-chart-1"
              value={formatSpend(partnerSettlementMember?.common_share ?? 0)}
            />
            <MiniStat label="Contribution" value={formatSpend(partnerSettlementMember?.contribution ?? 0)} />
          </div>
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setShowPartnerDialog(true)}>
            View common transactions
          </Button>
        </div>
      </CardContent>

      {partnerSettlementMember && (
        <PartnerCommonTransactionsDialog
          open={showPartnerDialog}
          onOpenChange={setShowPartnerDialog}
          invoiceId={invoiceId}
          partnerUserId={partnerSettlementMember.user_id}
          partnerLabel={partnerLabel}
        />
      )}
    </Card>
  );
}
