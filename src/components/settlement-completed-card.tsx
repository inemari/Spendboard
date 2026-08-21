"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, ListChecks, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { SettlementReviewStep } from "@/components/settlement-review-step";
import { PartnerCommonTransactionsDialog } from "@/components/partner-common-transactions-dialog";
import { HeroFigure, MiniStat } from "@/components/settlement-stat";
import { formatSpend } from "@/lib/format";
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
          <PartyPopper className="size-4 text-primary" />
          Settlement completed
        </p>
        <p className="text-xs text-muted-foreground">
          {settlement.completed_at ? new Date(settlement.completed_at).toLocaleDateString() : ""} · Total Common{" "}
          {formatSpend(settlement.common_total ?? 0)} → {formatSpend(settlement.common_share ?? 0)} each
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-xl">Your settlement</CardTitle>
              <Badge variant="default">Paid</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <HeroFigure icon={Banknote} size="lg" {...transferredLabel(mine?.transfer_total ?? 0)} />
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-primary/5 p-3">
              <MiniStat label="Personal" dotClassName="bg-chart-2" value={formatSpend(mine?.personal_total ?? 0)} />
              <MiniStat label="Common share" dotClassName="bg-chart-1" value={formatSpend(mine?.common_share ?? 0)} />
              <MiniStat label="Contribution" value={formatSpend(mine?.contribution ?? 0)} />
            </div>
            <Button variant="outline" className="w-fit" onClick={() => setShowOwn(true)}>
              <ListChecks />
              Review transactions
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-muted/20 shadow-none hover:translate-y-0 hover:shadow-none">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Partner</p>
                <CardTitle className="wrap-break-word text-base text-muted-foreground">{partnerLabel}</CardTitle>
              </div>
              <Badge variant="outline" className="border-border text-muted-foreground">Paid</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <HeroFigure icon={Banknote} size="sm" {...transferredLabel(partnerSettlementMember?.transfer_total ?? 0)} />
            <dl className="divide-y divide-border/60 rounded-xl bg-background/60 px-3">
              <PartnerFact label="Personal" value={formatSpend(partnerSettlementMember?.personal_total ?? 0)} />
              <PartnerFact label="Common share" value={formatSpend(partnerSettlementMember?.common_share ?? 0)} />
              <PartnerFact label="Contribution" value={formatSpend(partnerSettlementMember?.contribution ?? 0)} />
            </dl>
            <Button
              variant="outline"
              size="sm"
              className="w-fit border-border text-muted-foreground"
              onClick={() => setShowPartnerDialog(true)}
            >
              View common transactions
            </Button>
          </CardContent>
        </Card>
      </div>

      {partnerSettlementMember && (
        <PartnerCommonTransactionsDialog
          open={showPartnerDialog}
          onOpenChange={setShowPartnerDialog}
          invoiceId={invoiceId}
          partnerUserId={partnerSettlementMember.user_id}
          partnerLabel={partnerLabel}
        />
      )}
    </div>
  );
}

function PartnerFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-foreground/70">{value}</dd>
    </div>
  );
}
