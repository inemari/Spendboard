"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  PartyPopper,
  Receipt,
  Trash2,
  Users,
} from "lucide-react";
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
import { formatSpend, formatTransfer } from "@/lib/format";
import type { HouseholdMember, loadHousehold } from "@/lib/workspace-data";
import type { CreditInvoice, InvoiceMemberSummary, Settlement } from "@/lib/types";

type Household = Awaited<ReturnType<typeof loadHousehold>>;

function partnerLabel(members: HouseholdMember[], userId: string | null) {
  const partner = members.find((m) => m.user_id !== userId);
  return partner?.email ?? "your partner";
}

export function SettlementPanel({
  household,
  invoiceId,
}: {
  household: Household;
  invoiceId?: string;
}) {
  if (!household.householdId) {
    return <PairingCard />;
  }
  if (household.members.length < 2) {
    return <WaitingForPartnerCard pendingInviteCode={household.pendingInviteCode} />;
  }
  if (invoiceId) {
    return <SettlementDetail household={household} invoiceId={invoiceId} />;
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
  const { userId, members, invoices, settlements, categories } = household;
  const settlementByInvoice = useMemo(
    () => new Map(settlements.map((s) => [s.invoice_id, s])),
    [settlements],
  );
  const openInvoices = invoices.filter((i) => settlementByInvoice.get(i.id)?.status !== "completed");
  const openSummaries = useOpenInvoiceSummaries(openInvoices.map((i) => i.id));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Settlements</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Paired with {memberName(partnerLabel(members, userId))}
          </p>
        </div>
        <UploadButton
          categories={categories}
          householdId={household.householdId}
          openInvoices={openInvoices}
          creditOnly
          triggerLabel="New settlement"
        />
      </div>

      {invoices.length === 0 ? (
        <SettlementEmptyState />
      ) : (
        <div className="flex flex-col gap-4">
          {invoices.map((invoice) => (
            <SettlementRow
              key={invoice.id}
              invoice={invoice}
              settlement={settlementByInvoice.get(invoice.id)}
              summary={openSummaries[invoice.id]}
              userId={userId}
              members={members}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SettlementDetail({ household, invoiceId }: { household: Household; invoiceId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { userId, members, invoices, settlements, categories } = household;
  const invoice = invoices.find((item) => item.id === invoiceId);
  const settlement = settlements.find((item) => item.invoice_id === invoiceId);

  if (!invoice) return null;

  async function deleteSettlement() {
    setDeleting(true);
    const { error } = await supabase.rpc("delete_settlement", {
      p_invoice_id: invoiceId,
    });
    setDeleting(false);

    if (error) {
      toast.error(error.message ?? "Failed to delete settlement.");
      return;
    }

    toast.success("Settlement deleted. Its transactions were kept.");
    router.push("/settlement");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link
          href="/settlement"
          className="font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          Settlements
        </Link>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
        <span className="truncate font-semibold text-foreground" aria-current="page">
          {invoice.label}
        </span>
      </nav>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {invoice.label}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Settlement with {memberName(partnerLabel(members, userId))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {settlement?.status !== "completed" && (
            <UploadButton
              categories={categories}
              householdId={household.householdId}
              openInvoices={[invoice]}
              defaultInvoiceId={invoice.id}
              creditOnly
              triggerLabel="Upload transactions"
            />
          )}
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 />
            Delete settlement
          </Button>
        </div>
      </div>

      {settlement?.status === "completed" ? (
        <SettlementCompletedCard
          invoiceId={invoice.id}
          invoiceLabel={invoice.label}
          settlement={settlement}
          userId={userId}
          members={members}
          categories={categories}
        />
      ) : (
        <SettlementInvoiceFlow
          key={invoice.id}
          invoiceId={invoice.id}
          invoiceLabel={invoice.label}
          userId={userId}
          members={members}
          categories={categories}
          settlement={settlement}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {invoice.label}?</AlertDialogTitle>
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
              onClick={() => void deleteSettlement()}
            >
              {deleting ? "Deleting..." : "Delete settlement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function memberName(label: string) {
  const name = label.includes("@") ? label.split("@")[0] : label;
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "your partner";
}

const settlementDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatSettlementDate(value: string) {
  return settlementDateFormatter.format(new Date(value));
}

function SettlementRow({
  invoice,
  settlement,
  summary,
  userId,
  members,
}: {
  invoice: CreditInvoice;
  settlement: Settlement | undefined;
  summary: InvoiceMemberSummary[] | undefined;
  userId: string | null;
  members: HouseholdMember[];
}) {
  const completed = settlement?.status === "completed";

  return (
    <Link
      href={`/settlement/${invoice.id}`}
      className="group grid gap-4 rounded-2xl border bg-card px-5 py-5 shadow-[0_4px_16px_rgba(224,64,160,0.06)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_10px_28px_rgba(224,64,160,0.14)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:px-7"
    >
      <span
        className={`grid size-12 place-items-center rounded-full ${
          completed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-primary/10 text-primary"
        }`}
        aria-hidden="true"
      >
        {completed ? <CheckCircle2 className="size-6" /> : <Clock3 className="size-5" />}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-base font-semibold sm:text-lg">{invoice.label}</span>
        <span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          Created {formatSettlementDate(invoice.created_at)}
        </span>
      </span>

      <span className="min-w-0 sm:text-right">
        {completed ? (
          <CompletedInvoiceStatus settlement={settlement} userId={userId} />
        ) : (
          <OpenInvoiceStatus
            summary={summary}
            settlement={settlement}
            userId={userId}
            members={members}
          />
        )}
        <span className="mt-1 block text-sm text-muted-foreground">
          {completed && settlement.completed_at
            ? `Settled ${formatSettlementDate(settlement.completed_at)}`
            : "Open settlement"}
        </span>
      </span>

      <span className="flex items-center justify-between gap-3 sm:justify-end">
        <Badge
          variant={completed ? "default" : "outline"}
          className={completed ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "border-primary/30 text-primary"}
        >
          {completed ? "Settled" : "Open"}
        </Badge>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
      </span>
    </Link>
  );
}

function CompletedInvoiceStatus({ settlement, userId }: { settlement: Settlement; userId: string | null }) {
  const transfer = settlement.settlement_members.find((member) => member.user_id === userId)?.transfer_total ?? 0;
  return (
    <span className={`block font-semibold ${transfer < 0 ? "text-emerald-700 dark:text-emerald-300" : "text-foreground"}`}>
      {transfer < 0 ? "You received" : "You transferred"} {formatSpend(transfer)}
    </span>
  );
}

function SettlementEmptyState() {
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
          <p className="text-sm font-medium text-primary">Use “New settlement” to get started.</p>
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
  if (!summary) return <span className="text-sm text-muted-foreground">Loading totals…</span>;

  const needsReview = summary.some((s) => s.need_review_count > 0);
  const myPaid =
    settlement?.settlement_members.find((m) => m.user_id === userId)?.payment_status === "paid";
  const partnerPaid = settlement?.settlement_members.some(
    (m) => m.user_id !== userId && m.payment_status === "paid",
  );

  if (needsReview) {
    return (
      <span className="font-semibold text-amber-700 dark:text-amber-300">Needs review</span>
    );
  }

  if (myPaid || partnerPaid) {
    // Fixed-length copy, deliberately not interpolating an email here — a
    // long address would overflow this fixed-width sidebar column, unlike
    // the full detail pane, which already names the partner explicitly.
    return (
      <span className="font-semibold text-primary">
        {myPaid ? "Waiting for partner" : "Your turn to pay"}
      </span>
    );
  }

  const shares = computeSettlementShares(
    summary.map((s) => ({ userId: s.user_id, personalTotal: s.personal_total, commonTotal: s.common_total })),
  );
  const mine = shares.perMember.find((m) => m.userId === userId);
  const myContribution = members.find((m) => m.user_id === userId)?.default_contribution ?? 0;
  const myEstimate = mine ? remainingToTransfer(mine.transferBeforeContribution, myContribution) : null;

  if (myEstimate === null) {
    return <span className="font-semibold text-muted-foreground">Ready to review</span>;
  }

  const { label, value } = formatTransfer(myEstimate);
  return (
    <span className="font-semibold text-foreground">
      {label === "You're owed back" ? "You receive" : "You transfer"} ~{value}
    </span>
  );
}
