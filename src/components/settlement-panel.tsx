"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, Copy, PartyPopper, Receipt, Trash2, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UploadButton } from "@/components/upload-button";
import { SettlementInvoiceFlow } from "@/components/settlement-invoice-flow";
import { SettlementCompletedCard } from "@/components/settlement-completed-card";
import { computeSettlementShares, remainingToTransfer } from "@/lib/settlement";
import { formatTransfer } from "@/lib/format";
import type { HouseholdMember, loadHousehold } from "@/lib/workspace-data";
import type { CreditInvoice, InvoiceMemberSummary, Settlement } from "@/lib/types";

type Household = Awaited<ReturnType<typeof loadHousehold>>;

function partnerLabel(members: HouseholdMember[], userId: string | null) {
  const partner = members.find((m) => m.user_id !== userId);
  return partner?.email ?? "your partner";
}

export function SettlementPanel({ household }: { household: Household }) {
  if (!household.householdId) {
    return <PairingCard />;
  }
  if (household.members.length < 2) {
    return <WaitingForPartnerCard pendingInviteCode={household.pendingInviteCode} />;
  }
  return <SettlementWorkspace household={household} />;
}

function PairingCard() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function startInvite() {
    setBusy(true);
    const { error: createError } = await supabase.rpc("create_household");
    if (createError) {
      setBusy(false);
      toast.error(createError.message ?? "Failed to create household.");
      return;
    }
    const { error: inviteError } = await supabase.rpc("create_household_invite");
    setBusy(false);
    if (inviteError) {
      toast.error(inviteError.message ?? "Failed to create invite.");
      return;
    }
    router.refresh();
  }

  async function joinWithCode() {
    if (!code.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("redeem_household_invite", { p_code: code.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "Failed to join household.");
      return;
    }
    toast.success("Joined household!", { icon: <PartyPopper className="size-4" /> });
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
          <Users className="size-6 text-primary" />
          Settlement
        </h2>
        <p className="text-sm text-muted-foreground">
          Settling a shared credit-card bill needs a household of two — pair up with your
          partner first. Each of you keeps your own transactions private; only totals are ever
          shared.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite your partner</CardTitle>
          <CardDescription>Generates a code to share with them.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled={busy} onClick={() => void startInvite()}>
            Start pairing
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Have a code already?</CardTitle>
          <CardDescription>Enter the code your partner shared with you.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button disabled={busy || !code.trim()} onClick={() => void joinWithCode()}>
            Join
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function WaitingForPartnerCard({ pendingInviteCode }: { pendingInviteCode: string | null }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copy() {
    if (!pendingInviteCode) return;
    await navigator.clipboard.writeText(pendingInviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerate() {
    setBusy(true);
    const { error } = await supabase.rpc("create_household_invite");
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "Failed to create invite.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
      <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
        <Users className="size-6 text-primary" />
        Waiting for your partner
      </h2>
      <Card>
        <CardHeader>
          <CardTitle>Share this code with them</CardTitle>
          <CardDescription>
            They enter it on their own Settlement screen to finish pairing.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          {pendingInviteCode ? (
            <>
              <code className="rounded-md bg-muted px-3 py-1.5 text-sm font-medium">
                {pendingInviteCode}
              </code>
              <Button variant="outline" size="sm" onClick={() => void copy()}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </>
          ) : (
            <Button disabled={busy} size="sm" onClick={() => void regenerate()}>
              Generate a code
            </Button>
          )}
        </CardContent>
      </Card>
      {pendingInviteCode && (
        <Button variant="outline" size="sm" className="self-start" disabled={busy} onClick={() => void regenerate()}>
          Generate a new code
        </Button>
      )}
    </div>
  );
}

/** Live per-invoice totals for the Step-1 overview list, so it can show a
 * status and each member's estimated transfer before anyone opens the
 * invoice. Bounded by how many open invoices a household has (typically a
 * handful), so one RPC call per invoice, fanned out in parallel, is simpler
 * than a bespoke bulk RPC — worth revisiting if that ever stops being true. */
function useOpenInvoiceSummaries(invoiceIds: string[]) {
  const supabase = useMemo(() => createClient(), []);
  const key = invoiceIds.join(",");
  const [summaries, setSummaries] = useState<Record<string, InvoiceMemberSummary[]>>({});

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    Promise.all(
      key.split(",").map((id) =>
        supabase
          .rpc("household_invoice_summary", { p_invoice_id: id })
          .then(({ data }) => [id, (data ?? []) as InvoiceMemberSummary[]] as const),
      ),
    ).then((results) => {
      if (!cancelled) setSummaries(Object.fromEntries(results));
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, key]);

  return summaries;
}

function SettlementWorkspace({ household }: { household: Household }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { userId, members, invoices, settlements, categories } = household;
  const settlementByInvoice = useMemo(
    () => new Map(settlements.map((s) => [s.invoice_id, s])),
    [settlements],
  );
  const openInvoices = invoices.filter((i) => settlementByInvoice.get(i.id)?.status !== "completed");
  const completedInvoices = invoices.filter((i) => settlementByInvoice.get(i.id)?.status === "completed");
  const openSummaries = useOpenInvoiceSummaries(openInvoices.map((i) => i.id));

  // Undefined means "pick the best default" while null is an intentional
  // mobile "show the invoice list" state. Keeping those distinct also lets
  // the first invoice become selected after an empty-state upload refreshes
  // these props without remounting this client component.
  const [selectedId, setSelectedId] = useState<string | null>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const activeSelectedId =
    selectedId === undefined ? (openInvoices[0]?.id ?? invoices[0]?.id ?? null) : selectedId;
  const selectedInvoice = invoices.find((i) => i.id === activeSelectedId) ?? null;
  const selectedSettlement = activeSelectedId
    ? settlementByInvoice.get(activeSelectedId)
    : undefined;

  async function deleteSelectedSettlement() {
    if (!selectedInvoice) return;
    setDeleting(true);
    const { error } = await supabase.rpc("delete_settlement", {
      p_invoice_id: selectedInvoice.id,
    });
    setDeleting(false);

    if (error) {
      toast.error(error.message ?? "Failed to delete settlement.");
      return;
    }

    setDeleteDialogOpen(false);
    setSelectedId(undefined);
    toast.success("Settlement deleted. Its transactions were kept.");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
            <Receipt className="size-6 text-primary" />
            Settlement
          </h2>
          <p className="text-sm text-muted-foreground">
            You and {partnerLabel(members, userId)} each keep your own transactions private —
            only common-spending totals and the final split are shared.
          </p>
        </div>
        {invoices.length > 0 && (
          <UploadButton
            categories={categories}
            householdId={household.householdId}
            openInvoices={openInvoices}
            defaultInvoiceId={
              selectedInvoice && selectedSettlement?.status !== "completed"
                ? selectedInvoice.id
                : undefined
            }
            creditOnly
          />
        )}
      </div>

      {invoices.length === 0 ? (
        <SettlementEmptyState household={household} />
      ) : (
        <div className="grid gap-6 sm:grid-cols-[260px_1fr]">
          <div className="flex flex-col gap-4">
            <InvoiceList
              title="Open invoices"
              invoices={openInvoices}
              emptyLabel="Nothing to settle yet — upload a credit-card statement and file it under an invoice."
              selectedId={activeSelectedId}
              onSelect={setSelectedId}
              renderStatus={(invoice) => (
                <OpenInvoiceStatus
                  summary={openSummaries[invoice.id]}
                  settlement={settlementByInvoice.get(invoice.id)}
                  userId={userId}
                  members={members}
                />
              )}
            />
            <InvoiceList
              title="Completed"
              invoices={completedInvoices}
              emptyLabel="No settlements yet."
              selectedId={activeSelectedId}
              onSelect={setSelectedId}
            />
          </div>

          <div className="flex flex-col gap-4">
            {!selectedInvoice && (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Pick an invoice to review its settlement.
              </p>
            )}
            {selectedInvoice && (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground sm:hidden"
                >
                  <ChevronLeft className="size-4" />
                  All invoices
                </button>
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 />
                  Delete settlement
                </Button>
              </div>
            )}
            {selectedInvoice && selectedSettlement?.status === "completed" && (
              <SettlementCompletedCard
                invoiceId={selectedInvoice.id}
                invoiceLabel={selectedInvoice.label}
                settlement={selectedSettlement}
                userId={userId}
                members={members}
                categories={categories}
              />
            )}
            {selectedInvoice && selectedSettlement?.status !== "completed" && (
              <SettlementInvoiceFlow
                key={selectedInvoice.id}
                invoiceId={selectedInvoice.id}
                invoiceLabel={selectedInvoice.label}
                userId={userId}
                members={members}
                categories={categories}
                settlement={selectedSettlement}
              />
            )}
          </div>
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedInvoice?.label ?? "this settlement"}?</AlertDialogTitle>
            <AlertDialogDescription>
              The settlement, invoice, and payment history will be removed for both household
              members. The transactions themselves will be kept and can be filed under another
              settlement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={() => void deleteSelectedSettlement()}
            >
              {deleting ? "Deleting..." : "Delete settlement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SettlementEmptyState({ household }: { household: Household }) {
  return (
    <Card className="overflow-hidden border-primary/20 bg-card">
      <CardContent className="relative flex min-h-80 flex-col items-center justify-center overflow-hidden px-6 py-12 text-center">
        <div
          aria-hidden="true"
          className="absolute -top-20 -left-20 size-56 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -right-20 -bottom-24 size-64 rounded-full bg-tertiary/10 blur-3xl"
        />

        <div className="relative mb-5 grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary shadow-[0_8px_28px_rgba(224,64,160,0.16)]">
          <Receipt className="size-8" />
        </div>
        <Badge variant="outline" className="relative mb-3 border-primary/30 text-primary">
          Your first settlement
        </Badge>
        <h3 className="relative font-heading text-2xl font-bold">Start with a card statement</h3>
        <p className="relative mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          Upload a credit-card statement and name the invoice. Then you and your partner can
          review your own purchases privately and settle the shared total together.
        </p>
        <div className="relative mt-6">
          <UploadButton
            categories={household.categories}
            householdId={household.householdId}
            openInvoices={[]}
            creditOnly
          />
        </div>
        <p className="relative mt-4 text-xs text-muted-foreground">
          Excel, CSV, and PDF statements are supported.
        </p>
      </CardContent>
    </Card>
  );
}

function OpenInvoiceStatus({
  summary,
  settlement,
  userId,
  members,
}: {
  summary: InvoiceMemberSummary[] | undefined;
  settlement: Settlement | undefined;
  userId: string | null;
  members: HouseholdMember[];
}) {
  if (!summary) return null;

  const needsReview = summary.some((s) => s.need_review_count > 0);
  const myPaid =
    settlement?.settlement_members.find((m) => m.user_id === userId)?.payment_status === "paid";
  const partnerPaid = settlement?.settlement_members.some(
    (m) => m.user_id !== userId && m.payment_status === "paid",
  );

  if (needsReview) {
    return (
      <Badge variant="outline" className="border-amber-500/50 text-amber-600">
        Needs review
      </Badge>
    );
  }

  if (myPaid || partnerPaid) {
    // Fixed-length copy, deliberately not interpolating an email here — a
    // long address would overflow this fixed-width sidebar column, unlike
    // the full detail pane, which already names the partner explicitly.
    return (
      <Badge variant="outline" className="text-primary">
        {myPaid ? "Waiting for partner" : "Your turn to pay"}
      </Badge>
    );
  }

  const shares = computeSettlementShares(
    summary.map((s) => ({ userId: s.user_id, personalTotal: s.personal_total, commonTotal: s.common_total })),
  );
  const mine = shares.perMember.find((m) => m.userId === userId);
  const myContribution = members.find((m) => m.user_id === userId)?.default_contribution ?? 0;
  const myEstimate = mine ? remainingToTransfer(mine.transferBeforeContribution, myContribution) : null;

  if (myEstimate === null) {
    return <span className="text-xs text-muted-foreground">To pay</span>;
  }

  const { label, value } = formatTransfer(myEstimate);
  return (
    <span className="text-xs text-muted-foreground">
      You: ~{value} {label === "You're owed back" ? "back" : "to transfer"}
    </span>
  );
}

function InvoiceList({
  title,
  invoices,
  emptyLabel,
  selectedId,
  onSelect,
  renderStatus,
}: {
  title: string;
  invoices: CreditInvoice[];
  emptyLabel: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  renderStatus?: (invoice: CreditInvoice) => React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {invoices.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-1">
          {invoices.map((invoice) => (
            <button
              key={invoice.id}
              onClick={() => onSelect(invoice.id)}
              className={`flex flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                selectedId === invoice.id ? "bg-muted font-medium text-primary" : "hover:bg-muted/60"
              }`}
            >
              <span>{invoice.label}</span>
              {renderStatus?.(invoice)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
