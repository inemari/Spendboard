"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NewTransactionsSheet } from "@/components/new-transactions-sheet";
import { STATEMENT_FORMATS, type StatementFormatId } from "@/lib/statement-formats";
import type { CardType, Category, Transaction } from "@/lib/types";

export function UploadButton({
  year,
  month,
  categories,
}: {
  year: number;
  month: number;
  categories: Category[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingFormatRef = useRef<StatementFormatId | null>(null);
  const pendingCardTypeRef = useRef<CardType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cardTypeFormat, setCardTypeFormat] = useState<StatementFormatId | null>(null);
  const [newTransactions, setNewTransactions] = useState<Transaction[] | null>(null);

  async function uploadFile(file: File, formatId: StatementFormatId, cardType: CardType) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("format", formatId);
      formData.set("cardType", cardType);

      const res = await fetch(`/api/upload?year=${year}&month=${month}`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Upload failed.");
        return;
      }

      toast.success(`Imported ${data.imported} of ${data.total} transactions.`);
      router.refresh();
      setNewTransactions(data.inserted ?? []);
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  // Picking a format only decides which header aliases the server applies —
  // the card type isn't in any of these files, so it's asked for separately
  // before the file picker opens, rather than guessed from the format name.
  function pickFormat(formatId: StatementFormatId) {
    pendingFormatRef.current = formatId;
    setCardTypeFormat(formatId);
  }

  // The format + card type decide the file input's accept and which server
  // fields to send, so both have to travel between this click and the
  // input's onChange — stashed here since a native file input can't carry
  // extra payload itself.
  function pickCardType(cardType: CardType) {
    const formatId = pendingFormatRef.current;
    const format = STATEMENT_FORMATS.find((f) => f.id === formatId);
    if (!format || !inputRef.current) return;
    pendingCardTypeRef.current = cardType;
    setCardTypeFormat(null);
    inputRef.current.accept = format.accept;
    inputRef.current.click();
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const formatId = pendingFormatRef.current;
          const cardType = pendingCardTypeRef.current;
          if (file && formatId && cardType) void uploadFile(file, formatId, cardType);
          e.target.value = "";
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button size="sm" variant="outline" disabled={isUploading}>
              <Upload />
              {isUploading ? "Uploading..." : "Upload statement"}
            </Button>
          }
        />
        <DropdownMenuContent>
          {STATEMENT_FORMATS.map((format) => (
            <DropdownMenuItem key={format.id} onClick={() => pickFormat(format.id)}>
              {format.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={cardTypeFormat !== null}
        onOpenChange={(open) => !open && setCardTypeFormat(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credit or debit card?</DialogTitle>
            <DialogDescription>
              Every transaction in this file will be tagged with the card type you pick.
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
        categorizeHref={`/${year}/${month}/categorize`}
        onOpenChange={(open) => !open && setNewTransactions(null)}
      />
    </>
  );
}
