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
  defaultInvoiceId,
  creditOnly = false,
  triggerLabel,
}: {
  categories: Category[];
  /** Null for a user with no household — the invoice step is skipped
   * entirely for them, same upload flow as before this feature existed. */
  householdId?: string | null;
  openInvoices?: CreditInvoice[];
  /** Preselects the invoice currently open on the Settlement screen. */
  defaultInvoiceId?: string;
  /** Starts directly in the credit-card invoice flow. Used from Settlement,
   * where a debit-card upload cannot produce anything to settle. */
  creditOnly?: boolean;
  /** Optional context-specific copy for the trigger. Settlement uses this to
   * present invoice creation as the start of a new settlement. */
  triggerLabel?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCardTypeRef = useRef<CardType | null>(null);
  const pendingInvoiceIdRef = useRef<string | null>(null);
  const pendingInvoiceLabelRef = useRef<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cardTypeDialogOpen, setCardTypeDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceChoice, setInvoiceChoice] = useState<string>("");
  const [newInvoiceLabel, setNewInvoiceLabel] = useState("");
  const [newTransactions, setNewTransactions] = useState<Transaction[] | null>(null);

  async function uploadFile(
    file: File,
    cardType: CardType,
    creditInvoiceId: string | null,
    creditInvoiceLabel: string | null,
  ) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("cardType", cardType);
      if (creditInvoiceId) formData.set("creditInvoiceId", creditInvoiceId);
      if (creditInvoiceLabel) formData.set("creditInvoiceLabel", creditInvoiceLabel);

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

      const message =
        data.attached > 0
          ? data.imported > 0
            ? `Imported ${data.imported} new and added ${data.attached} existing transactions to the invoice.`
            : `Added ${data.attached} existing transactions to the invoice.`
          : `Imported ${data.imported} of ${data.total} transactions.`;
      toast.success(message, {
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
    pendingInvoiceIdRef.current = null;
    pendingInvoiceLabelRef.current = null;
    setCardTypeDialogOpen(false);

    if (cardType === "credit" && householdId) {
      const preferredInvoice = openInvoices?.some((invoice) => invoice.id === defaultInvoiceId)
        ? defaultInvoiceId
        : openInvoices?.[0]?.id;
      setInvoiceChoice(preferredInvoice ?? NEW_INVOICE_VALUE);
      setNewInvoiceLabel("");
      setInvoiceDialogOpen(true);
      return;
    }

    inputRef.current?.click();
  }

  function confirmInvoice() {
    if (invoiceChoice === NEW_INVOICE_VALUE) {
      const label = newInvoiceLabel.trim();
      if (!label) {
        toast.error("Name this invoice (e.g. “August 2026”).");
        return;
      }
      // Defer creating the invoice until a file has actually been selected.
      // Keeping this handler synchronous preserves the browser's user gesture,
      // so the native file picker is allowed to open from the Continue click.
      pendingInvoiceIdRef.current = null;
      pendingInvoiceLabelRef.current = label;
    } else {
      pendingInvoiceIdRef.current = invoiceChoice;
      pendingInvoiceLabelRef.current = null;
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
          if (file && cardType) {
            void uploadFile(
              file,
              cardType,
              pendingInvoiceIdRef.current,
              pendingInvoiceLabelRef.current,
            );
          }
          pendingInvoiceIdRef.current = null;
          pendingInvoiceLabelRef.current = null;
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
            <Button onClick={confirmInvoice}>
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
