"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { TransactionCard } from "@/components/transaction-card";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

export function DraggableTransactionCard({
  transaction,
  categories,
  onCategoryChange,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
  selected = false,
  onToggleSelect,
}: {
  transaction: Transaction;
  categories: Category[];
  onCategoryChange: (categoryId: string | null) => void;
  onTypeToggle: () => void;
  onCardTypeToggle: () => void;
  onNotesChange: (notes: string | null) => void;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: transaction.id,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("touch-none", isDragging && "z-10 opacity-50")}
    >
      <TransactionCard
        transaction={transaction}
        categories={categories}
        onCategoryChange={onCategoryChange}
        onTypeToggle={onTypeToggle}
        onCardTypeToggle={onCardTypeToggle}
        onNotesChange={onNotesChange}
        selected={selected}
        onToggleSelect={onToggleSelect}
      />
    </div>
  );
}
