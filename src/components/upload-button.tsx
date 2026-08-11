"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, PartyPopper, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewTransactionsSheet } from "@/components/new-transactions-sheet";
import { STATEMENT_FORMATS } from "@/lib/statement-formats";
import type { CardType, Category, Transaction } from "@/lib/types";

// The file's own content decides its format (see parseTransactionFile) — the
// input just needs to accept every extension any known format can produce.
const ACCEPT = Array.from(
  new Set(STATEMENT_FORMATS.flatMap((f) => f.accept.split(","))),
).join(",");

export function UploadButton({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCardTypeRef = useRef<CardType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cardTypeDialogOpen, setCardTypeDialogOpen] = useState(false);
  const [newTransactions, setNewTransactions] = useState<Transaction[] | null>(null);

  async function uploadFile(file: File, cardType: CardType) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("cardType", cardType);

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
  function pickCardType(cardType: CardType) {
    pendingCardTypeRef.current = cardType;
    setCardTypeDialogOpen(false);
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
          if (file && cardType) void uploadFile(file, cardType);
          e.target.value = "";
        }}
      />

      <Button
        size="sm"
        variant="outline"
        disabled={isUploading}
        onClick={() => setCardTypeDialogOpen(true)}
      >
        <Upload />
        {isUploading ? "Uploading..." : "Upload statement"}
      </Button>

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

      <NewTransactionsSheet
        transactions={newTransactions}
        categories={categories}
        categorizeHref="/categorize"
        onOpenChange={(open) => !open && setNewTransactions(null)}
      />
    </>
  );
}
