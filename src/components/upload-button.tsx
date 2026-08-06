"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NewTransactionsSheet } from "@/components/new-transactions-sheet";
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

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
          e.target.value = "";
        }}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload />
        {isUploading ? "Uploading..." : "Upload statement"}
      </Button>

      <NewTransactionsSheet
        transactions={newTransactions}
        categories={categories}
        categorizeHref={`/${year}/${month}/categorize`}
        onOpenChange={(open) => !open && setNewTransactions(null)}
      />
    </>
  );
}
