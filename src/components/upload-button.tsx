"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewTransactionsSheet } from "@/components/new-transactions-sheet";
import { STATEMENT_FORMATS, type StatementFormatId } from "@/lib/statement-formats";
import type { Category, Transaction } from "@/lib/types";

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
  const [isUploading, setIsUploading] = useState(false);
  const [newTransactions, setNewTransactions] = useState<Transaction[] | null>(null);

  async function uploadFile(file: File, formatId: StatementFormatId) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("format", formatId);

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

  // The picked format decides which header aliases the server applies (e.g.
  // Nordea's "Navn"/"Betalingstype" vs. the Excel export's "Spesifikasjon"/
  // "Sted"), so the file input's own accept + the chosen format id have to
  // travel together — stashed here between the menu click and the input's
  // onChange, since a native file input can't carry extra payload itself.
  function pickFormat(formatId: StatementFormatId) {
    const format = STATEMENT_FORMATS.find((f) => f.id === formatId);
    if (!format || !inputRef.current) return;
    pendingFormatRef.current = formatId;
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
          if (file && formatId) void uploadFile(file, formatId);
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

      <NewTransactionsSheet
        transactions={newTransactions}
        categories={categories}
        categorizeHref={`/${year}/${month}/categorize`}
        onOpenChange={(open) => !open && setNewTransactions(null)}
      />
    </>
  );
}
