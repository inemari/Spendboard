"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, PartyPopper, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NewTransactionsSheet } from "@/components/new-transactions-sheet";
import { createClient } from "@/lib/supabase/client";
import { STATEMENT_FORMATS } from "@/lib/statement-formats";
import type { CardType, Category, CreditInvoice, Transaction } from "@/lib/types";

// The file's own content decides its format (see parseTransactionFile) — the
// input just needs to accept every extension any known format can produce.
const ACCEPT = Array.from(
  new Set(STATEMENT_FORMATS.flatMap((f) => f.accept.split(","))),
).join(",");

const NEW_INVOICE_VALUE = "__new__";

export function UploadButton({
  categories,
  householdId,
  openInvoices,
  creditOnly = false,
  triggerLabel,
}: {
  categories: Category[];
  /** Null for a user with no household — the invoice step is skipped
   * entirely for them, same upload flow as before this feature existed. */
  householdId?: string | null;
  openInvoices?: CreditInvoice[];
  /** Starts directly in the credit-card invoice flow. Used from Settlement,
   * where a debit-card upload cannot produce anything to settle. */
  creditOnly?: boolean;
  /** Optional context-specific copy for the trigger. Settlement uses this to
   * present invoice creation as the start of a new settlement. */
  triggerLabel?: string;
}) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCardTypeRef = useRef<CardType | null>(null);
  const pendingInvoiceIdRef = useRef<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cardTypeDialogOpen, setCardTypeDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceChoice, setInvoiceChoice] = useState<string>("");
  const [newInvoiceLabel, setNewInvoiceLabel] = useState("");
  const [resolvingInvoice, setResolvingInvoice] = useState(false);
  const [newTransactions, setNewTransactions] = useState<Transaction[] | null>(null);

  async function uploadFile(file: File, cardType: CardType, creditInvoiceId: string | null) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("cardType", cardType);
      if (creditInvoiceId) formData.set("creditInvoiceId", creditInvoiceId);

      // No year/month: each transaction is filed under the month its own date
      // falls in, so the upload doesn't depend on what the overview happens to
      // be showing (which can be a span covering several months, or none).
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Upload failed.");
        return;
      }

      toast.success(`Imported ${data.imported} of ${data.total} transactions.`, {
        icon: <PartyPopper className="size-4" />,
      });
      router.refresh();
      setNewTransactions(data.inserted ?? []);
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  // The card type isn't in any file's content, so it's asked for before the
  // file picker opens rather than guessed — travels via this ref into the
  // input's onChange since a native file input can't carry extra payload.
  // Credit cards get one extra step (which invoice) only for a paired user —
  // a solo user has no household to file an invoice under, so this behaves
  // exactly as it did before the settlement feature existed.
  function pickCardType(cardType: CardType) {
    pendingCardTypeRef.current = cardType;
    setCardTypeDialogOpen(false);

    if (cardType === "credit" && householdId) {
      setInvoiceChoice(openInvoices?.[0]?.id ?? NEW_INVOICE_VALUE);
      setNewInvoiceLabel("");
      setInvoiceDialogOpen(true);
      return;
    }

    inputRef.current?.click();
  }

  async function confirmInvoice() {
    if (invoiceChoice === NEW_INVOICE_VALUE) {
      const label = newInvoiceLabel.trim();
      if (!label) {
        toast.error("Name this invoice (e.g. “August 2026”).");
        return;
      }
      setResolvingInvoice(true);
      const { data, error } = await supabase
        .from("credit_invoices")
        .insert({ household_id: householdId, label })
        .select("id")
        .single();
      setResolvingInvoice(false);

      if (error || !data) {
        toast.error("Failed to create invoice.");
        return;
      }
      pendingInvoiceIdRef.current = data.id;
    } else {
      pendingInvoiceIdRef.current = invoiceChoice;
    }

    setInvoiceDialogOpen(false);
    inputRef.current?.click();
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const cardType = pendingCardTypeRef.current;
          if (file && cardType) void uploadFile(file, cardType, pendingInvoiceIdRef.current);
          pendingInvoiceIdRef.current = null;
          e.target.value = "";
        }}
      />

      <Button
        size={creditOnly ? "default" : "sm"}
        variant={creditOnly ? "default" : "outline"}
        disabled={isUploading}
        onClick={() => (creditOnly ? pickCardType("credit") : setCardTypeDialogOpen(true))}
      >
        {triggerLabel ? <Plus /> : <Upload />}
        {isUploading
          ? "Uploading..."
          : triggerLabel ?? (creditOnly
            ? "Upload credit-card statement"
            : "Upload statement")}
      </Button>

      {!creditOnly && (
        <Dialog open={cardTypeDialogOpen} onOpenChange={setCardTypeDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Credit or debit card?</DialogTitle>
              <DialogDescription>
                Every transaction in this file will be tagged with the card type you pick. The
                file&rsquo;s format (Excel, PDF, CSV, and so on) is detected automatically.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => pickCardType("debit")}>
                <CreditCard />
                Debit
              </Button>
              <Button onClick={() => pickCardType("credit")}>
                <CreditCard />
                Credit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Which invoice?</DialogTitle>
            <DialogDescription>
              Credit-card billing periods rarely line up with calendar months, so pick which
              invoice these transactions belong to (shared with your household) — an existing
              one, or a new one you name now.
            </DialogDescription>
          </DialogHeader>

          <Select value={invoiceChoice} onValueChange={(v) => v && setInvoiceChoice(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an invoice…" />
            </SelectTrigger>
            <SelectContent>
              {openInvoices?.map((invoice) => (
                <SelectItem key={invoice.id} value={invoice.id}>
                  {invoice.label}
                </SelectItem>
              ))}
              <SelectItem value={NEW_INVOICE_VALUE}>New invoice…</SelectItem>
            </SelectContent>
          </Select>

          {invoiceChoice === NEW_INVOICE_VALUE && (
            <Input
              autoFocus
              placeholder="Invoice name (e.g. August 2026)"
              value={newInvoiceLabel}
              onChange={(e) => setNewInvoiceLabel(e.target.value)}
            />
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={resolvingInvoice} onClick={() => void confirmInvoice()}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewTransactionsSheet
        transactions={newTransactions}
        categories={categories}
        categorizeHref="/categorize"
        onOpenChange={(open) => !open && setNewTransactions(null)}
      />
    </>
  );
}
