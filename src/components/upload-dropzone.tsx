"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NewTransactionsSheet } from "@/components/new-transactions-sheet";
import type { Category, Transaction } from "@/lib/types";

export function UploadDropzone({
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
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newTransactions, setNewTransactions] = useState<Transaction[] | null>(null);

  async function uploadFile(file: File) {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);

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

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) void uploadFile(file);
  }

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-8 text-center transition-colors",
          isDragging ? "border-primary bg-muted" : "border-border",
          isUploading && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="font-medium">
          {isUploading ? "Uploading..." : "Drop a bank statement here, or click to browse"}
        </p>
        <p className="text-sm text-muted-foreground">Accepts .csv, .xlsx, .xls</p>
      </div>

      <NewTransactionsSheet
        transactions={newTransactions}
        categories={categories}
        categorizeHref={`/${year}/${month}/categorize`}
        onOpenChange={(open) => !open && setNewTransactions(null)}
      />
    </>
  );
}
