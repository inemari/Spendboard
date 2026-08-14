"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, PartyPopper, Receipt, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { HouseholdMember, loadHousehold } from "@/lib/workspace-data";
import type { InvoiceMemberSummary } from "@/lib/types";

type Household = Awaited<ReturnType<typeof loadHousehold>>;

const currency = new Intl.NumberFormat(undefined, { style: "currency", currency: "NOK" });

function fmt(n: number) {
  return currency.format(Math.abs(n));
}

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

function SettlementWorkspace({ household }: { household: Household }) {
  const { userId, householdId, members, myContribution, invoices, settlements } = household;
  const settledByInvoice = useMemo(
    () => new Map(settlements.map((s) => [s.invoice_id, s])),
    [settlements],
  );
  const openInvoices = invoices.filter((i) => !settledByInvoice.has(i.id));
  const completedInvoices = invoices.filter((i) => settledByInvoice.has(i.id));

  const [selectedId, setSelectedId] = useState<string | null>(openInvoices[0]?.id ?? null);
  const selectedInvoice = invoices.find((i) => i.id === selectedId) ?? null;
  const selectedSettlement = selectedId ? settledByInvoice.get(selectedId) ?? null : null;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
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

      <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-4">
          <InvoiceList
            title="Open invoices"
            invoices={openInvoices}
            emptyLabel="Nothing to settle yet — upload a credit-card statement and file it under an invoice."
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <InvoiceList
            title="Completed"
            invoices={completedInvoices}
            emptyLabel="No settlements yet."
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        <div>
          {!selectedInvoice && (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Pick an invoice to review its settlement.
            </p>
          )}
          {selectedInvoice && selectedSettlement && (
            <CompletedSettlementCard
              invoice={selectedInvoice}
              settlement={selectedSettlement}
              userId={userId}
              members={members}
            />
          )}
          {selectedInvoice && !selectedSettlement && (
            <OpenInvoiceCard
              key={selectedInvoice.id}
              invoiceId={selectedInvoice.id}
              householdId={householdId!}
              userId={userId}
              members={members}
              myContribution={myContribution}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function InvoiceList({
  title,
  invoices,
  emptyLabel,
  selectedId,
  onSelect,
}: {
  title: string;
  invoices: { id: string; label: string }[];
  emptyLabel: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
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
              className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                selectedId === invoice.id ? "bg-muted font-medium text-primary" : "hover:bg-muted/60"
              }`}
            >
              {invoice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OpenInvoiceCard({
  invoiceId,
  householdId,
  userId,
  members,
  myContribution,
}: {
  invoiceId: string;
  householdId: string;
  userId: string | null;
  members: HouseholdMember[];
  myContribution: number;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [summary, setSummary] = useState<InvoiceMemberSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [contribution, setContribution] = useState(myContribution);
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase
      .rpc("household_invoice_summary", { p_invoice_id: invoiceId })
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          toast.error("Failed to load this invoice's totals.");
          return;
        }
        setSummary(data ?? []);
      });
  }, [supabase, invoiceId]);

  if (loading || !summary) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  const mine = summary.find((s) => s.is_self);
  const partner = summary.find((s) => !s.is_self);
  const totalCommon = summary.reduce((sum, s) => sum + s.common_total, 0);
  const share = totalCommon / 2;
  const myResponsibility = (mine?.personal_total ?? 0) + share;
  const remaining = myResponsibility - contribution;

  async function handleComplete() {
    setCompleting(true);
    if (saveAsDefault) {
      await supabase.rpc("set_default_contribution", { p_amount: contribution });
    }
    const { error } = await supabase.rpc("complete_settlement", {
      p_invoice_id: invoiceId,
      p_contribution: contribution,
    });
    setCompleting(false);
    if (error) {
      toast.error(error.message ?? "Failed to complete settlement.");
      return;
    }
    toast.success("Settlement completed!", { icon: <PartyPopper className="size-4" /> });
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your settlement calculation</CardTitle>
        <CardDescription>
          {partnerLabel(members, userId)}&rsquo;s personal spending and individual transactions
          stay private — only their common-spending total is shown here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <Row label="Your personal spending" value={fmt(mine?.personal_total ?? 0)} />
        <Row label="Your common spending" value={fmt(mine?.common_total ?? 0)} />
        <Row
          label={`${partnerLabel(members, userId)}'s common spending`}
          value={fmt(partner?.common_total ?? 0)}
        />
        <Row label="Combined common spending" value={fmt(totalCommon)} strong />
        <Row label="Your share (50%)" value={fmt(share)} />
        <Row label="Your responsibility" value={fmt(myResponsibility)} strong />

        {(mine?.need_review_count ?? 0) > 0 && (
          <Badge variant="outline" className="w-fit border-amber-500/50 text-amber-600">
            {mine?.need_review_count} of your transactions still need review
          </Badge>
        )}

        <div className="flex items-center gap-2 pt-2">
          <label htmlFor="contribution" className="w-40 shrink-0 text-muted-foreground">
            Your contribution
          </label>
          <Input
            id="contribution"
            type="number"
            className="w-32"
            value={contribution}
            onChange={(e) => setContribution(Number(e.target.value) || 0)}
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="size-3.5 accent-primary"
            checked={saveAsDefault}
            onChange={(e) => setSaveAsDefault(e.target.checked)}
          />
          Save as my default recurring contribution
        </label>

        <Row label="Remaining amount to transfer" value={fmt(remaining)} strong />

        <Button
          className="mt-2 self-start"
          disabled={completing}
          onClick={() => void handleComplete()}
        >
          Mark settlement completed
        </Button>
      </CardContent>
    </Card>
  );
}

function CompletedSettlementCard({
  invoice,
  settlement,
  userId,
  members,
}: {
  invoice: { id: string; label: string };
  settlement: Awaited<ReturnType<typeof loadHousehold>>["settlements"][number];
  userId: string | null;
  members: HouseholdMember[];
}) {
  const mine = settlement.per_member.find((m) => m.user_id === userId);
  const completedByMe = settlement.completed_by === userId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{invoice.label} — settled</CardTitle>
        <CardDescription>
          Completed {new Date(settlement.completed_at).toLocaleDateString()} by{" "}
          {completedByMe ? "you" : partnerLabel(members, userId)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <Row label="Your personal spending" value={fmt(mine?.personal_total ?? 0)} />
        <Row label="Combined common spending" value={fmt(settlement.common_total)} />
        <Row label="Your share (50%)" value={fmt(settlement.common_share)} />
        <Row label="Your contribution" value={fmt(mine?.contribution ?? 0)} />
        <Row label="Amount transferred" value={fmt(mine?.amount_due ?? 0)} strong />
      </CardContent>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "font-semibold" : ""}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
