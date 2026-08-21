"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Banknote, Loader2, PartyPopper, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PartnerCommonTransactionsDialog } from "@/components/partner-common-transactions-dialog";
import { HeroFigure, MiniStat } from "@/components/settlement-stat";
import { useInvoiceSummary } from "@/hooks/use-invoice-summary";
import { computeSettlementShares, remainingToTransfer } from "@/lib/settlement";
import { formatSpend, formatTransfer } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HouseholdMember } from "@/lib/workspace-data";
import type { Settlement } from "@/lib/types";

export function SettlementSummaryStep({
  invoiceId,
  userId,
  members,
  settlement,
  onEditPersonal,
  onEditCommon,
  onMutated,
}: {
  invoiceId: string;
  userId: string | null;
  members: HouseholdMember[];
  settlement: Settlement | undefined;
  onEditPersonal: () => void;
  onEditCommon: () => void;
  onMutated: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const { summary, loading, error, retry } = useInvoiceSummary(invoiceId);
  const [busy, setBusy] = useState(false);
  const [showPartnerDialog, setShowPartnerDialog] = useState(false);

  const mySettlementMember = settlement?.settlement_members.find((m) => m.user_id === userId);
  const [contribution, setContribution] = useState<number>(
    mySettlementMember?.contribution ?? members.find((m) => m.user_id === userId)?.default_contribution ?? 0,
  );
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading settlement totals…
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center text-sm">
          <p className="text-destructive">{error ?? "Failed to load this invoice's totals."}</p>
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const me = summary.find((s) => s.is_self);
  const partner = summary.find((s) => !s.is_self);
  const partnerMember = members.find((m) => m.user_id === partner?.user_id);
  const partnerSettlementMember = settlement?.settlement_members.find((m) => m.user_id === partner?.user_id);
  const partnerLabel = partnerMember?.email ?? "your partner";

  const shares = computeSettlementShares(
    summary.map((s) => ({ userId: s.user_id, personalTotal: s.personal_total, commonTotal: s.common_total })),
  );
  const myShare = shares.perMember.find((p) => p.userId === me?.user_id);
  const partnerShare = shares.perMember.find((p) => p.userId === partner?.user_id);

  const myRemaining = myShare ? remainingToTransfer(myShare.transferBeforeContribution, contribution) : 0;
  const partnerContribution =
    partnerSettlementMember?.contribution ?? partnerMember?.default_contribution ?? 0;
  const partnerRemaining = partnerShare
    ? remainingToTransfer(partnerShare.transferBeforeContribution, partnerContribution)
    : 0;

  const myPaid = mySettlementMember?.payment_status === "paid";
  const partnerPaid = partnerSettlementMember?.payment_status === "paid";
  const anyoneNeedsReview = (me?.need_review_count ?? 0) > 0 || (partner?.need_review_count ?? 0) > 0;

  async function markPaid() {
    setBusy(true);
    if (saveAsDefault) {
      await supabase.rpc("set_default_contribution", { p_amount: contribution });
    }
    const { error } = await supabase.rpc("mark_settlement_paid", {
      p_invoice_id: invoiceId,
      p_contribution: contribution,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "Failed to mark as paid.");
      return;
    }
    toast.success("Marked as paid", { icon: <PartyPopper className="size-4" /> });
    onMutated();
  }

  async function unmarkPaid() {
    setBusy(true);
    const { error } = await supabase.rpc("unmark_settlement_paid", { p_invoice_id: invoiceId });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "Failed to update payment status.");
      return;
    }
    onMutated();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Household context only — deliberately understated, since the
          per-person "amount to transfer" below is the figure that matters,
          not the shared pot it's derived from. */}
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        Total Common {formatSpend(shares.commonTotal)} → {formatSpend(shares.commonShare)} each
      </p>

      {/* Your section — the primary focus of this screen: a full-size hero
          figure for the one number that matters (what you transfer), with
          Personal/Common share/Contribution as an equal-weight supporting
          row underneath, matching the requested priority order. */}
      <Card className={cn("border-2 border-primary/30", myPaid && "border-green-500/50")}>
        <CardHeader>
          <CardTitle className="text-xl">You</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <HeroFigure icon={Banknote} size="lg" {...formatTransfer(myRemaining)} />
            <div className="flex items-center gap-2">
              <Badge variant={myPaid ? "default" : "outline"}>{myPaid ? "Paid" : "To pay"}</Badge>
              {myPaid ? (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void unmarkPaid()}>
                  Mark as not paid
                </Button>
              ) : (
                <Button size="sm" disabled={busy || anyoneNeedsReview} onClick={() => void markPaid()}>
                  Mark as paid
                </Button>
              )}
            </div>
          </div>
          {anyoneNeedsReview && !myPaid && (
            <p className="text-xs text-muted-foreground">
              Resolve every Need review transaction on this invoice before paying.
            </p>
          )}

          <div className="grid grid-cols-3 gap-3 rounded-xl bg-primary/5 p-3">
            <MiniStat label="Personal" dotClassName="bg-chart-2" value={formatSpend(myShare?.personalTotal ?? 0)} />
            <MiniStat label="Common share" dotClassName="bg-chart-1" value={formatSpend(myShare?.commonShare ?? 0)} />
            <div className="flex flex-col gap-0.5">
              <label htmlFor="contribution" className="text-xs text-muted-foreground">
                Contribution
              </label>
              <div className="flex items-center gap-1">
                <Input
                  id="contribution"
                  type="number"
                  className="h-7 w-16 px-1.5 text-base font-bold"
                  disabled={myPaid}
                  value={contribution}
                  onChange={(e) => setContribution(Number(e.target.value) || 0)}
                />
                <span className="text-xs text-muted-foreground">kr</span>
              </div>
            </div>
          </div>
          {!myPaid && (
            <label className="-mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="size-3.5 accent-primary"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
              />
              Save as my new default
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onEditPersonal}>
              Edit Personal
            </Button>
            <Button variant="outline" size="sm" onClick={onEditCommon}>
              Edit Common
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Partner's section — same shape, deliberately quieter and smaller:
          less saturated accent, a smaller hero figure, tighter spacing. */}
      <Card className={cn("border-secondary/25", partnerPaid && "border-green-500/40")}>
        <CardHeader className="pb-2">
          <CardTitle className="wrap-break-word text-base text-muted-foreground">{partnerLabel}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <HeroFigure icon={Banknote} size="sm" {...formatTransfer(partnerRemaining)} />
            <Badge variant={partnerPaid ? "default" : "outline"}>{partnerPaid ? "Paid" : "To pay"}</Badge>
          </div>

          {(partner?.need_review_count ?? 0) > 0 && (
            <Badge variant="outline" className="w-fit border-amber-500/50 text-amber-600">
              <AlertTriangle className="size-3" />
              Waiting for {partnerLabel} to finish reviewing {partner?.need_review_count} transaction
              {(partner?.need_review_count ?? 0) > 1 ? "s" : ""}
            </Badge>
          )}

          <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/50 p-2.5">
            <MiniStat
              label="Personal"
              dotClassName="bg-chart-2"
              value={formatSpend(partnerShare?.personalTotal ?? 0)}
            />
            <MiniStat
              label="Common share"
              dotClassName="bg-chart-1"
              value={formatSpend(partnerShare?.commonShare ?? 0)}
            />
            <MiniStat label="Contribution" value={formatSpend(partnerContribution)} />
          </div>

          <Button variant="outline" size="sm" className="w-fit" onClick={() => setShowPartnerDialog(true)}>
            View common transactions
          </Button>
        </CardContent>
      </Card>

      {partner && (
        <PartnerCommonTransactionsDialog
          open={showPartnerDialog}
          onOpenChange={setShowPartnerDialog}
          invoiceId={invoiceId}
          partnerUserId={partner.user_id}
          partnerLabel={partnerLabel}
        />
      )}
    </div>
  );
}
