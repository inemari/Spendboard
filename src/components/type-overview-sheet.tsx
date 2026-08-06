"use client";

import { Inbox } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TransactionCard } from "@/components/transaction-card";
import { formatAmount, formatTxType } from "@/lib/format";
import type { Category, Transaction, TxType } from "@/lib/types";

export function TypeOverviewSheet({
  type,
  transactions,
  categories,
  onOpenChange,
  onCategoryChange,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
  onDelete,
}: {
  type: TxType | null;
  transactions: Transaction[];
  categories: Category[];
  onOpenChange: (open: boolean) => void;
  onCategoryChange: (id: string, categoryId: string | null) => void;
  onTypeToggle: (id: string, currentType: TxType) => void;
  onCardTypeToggle: (id: string, currentCardType: Transaction["card_type"]) => void;
  onNotesChange: (id: string, notes: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const filtered = type
    ? transactions.filter((t) => t.type === type).sort((a, b) => (a.date < b.date ? 1 : -1))
    : [];
  const total = filtered.reduce((sum, t) => sum + t.amount, 0);

  return (
    <Sheet open={type !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{type ? formatTxType(type) : ""} transactions</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {filtered.length} transactions · {formatAmount(total)}
          </p>
        </SheetHeader>

        <div className="flex flex-col gap-2 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
              <Inbox className="size-5" />
              No transactions here yet.
            </div>
          ) : (
            filtered.map((t) => (
              <TransactionCard
                key={t.id}
                transaction={t}
                categories={categories}
                onCategoryChange={(categoryId) => onCategoryChange(t.id, categoryId)}
                onTypeToggle={() => onTypeToggle(t.id, t.type)}
                onCardTypeToggle={() => onCardTypeToggle(t.id, t.card_type)}
                onNotesChange={(notes) => onNotesChange(t.id, notes)}
                onDelete={() => onDelete(t.id)}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
