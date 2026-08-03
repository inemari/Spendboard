"use client";

import { useDroppable } from "@dnd-kit/core";
import { DraggableTransactionCard } from "@/components/draggable-transaction-card";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

export function CategoryColumn({
  id,
  title,
  transactions,
  categories,
  onCategoryChange,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
}: {
  id: string;
  title: string;
  transactions: Transaction[];
  categories: Category[];
  onCategoryChange: (id: string, categoryId: string | null) => void;
  onTypeToggle: (id: string, currentType: Transaction["type"]) => void;
  onCardTypeToggle: (id: string, currentCardType: Transaction["card_type"]) => void;
  onNotesChange: (id: string, notes: string | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-xl border p-3 transition-colors",
        isOver ? "border-primary bg-muted/60" : "border-border",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">
          {formatAmount(total)}
        </span>
      </div>

      <div className="flex min-h-24 flex-col gap-2">
        {transactions.length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            Drop transactions here
          </p>
        )}
        {transactions.map((t) => (
          <DraggableTransactionCard
            key={t.id}
            transaction={t}
            categories={categories}
            onCategoryChange={(categoryId) => onCategoryChange(t.id, categoryId)}
            onTypeToggle={() => onTypeToggle(t.id, t.type)}
            onCardTypeToggle={() => onCardTypeToggle(t.id, t.card_type)}
            onNotesChange={(notes) => onNotesChange(t.id, notes)}
          />
        ))}
      </div>
    </div>
  );
}
