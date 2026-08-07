"use client";

import { useDraggable } from "@dnd-kit/core";
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
  onDelete,
  selected = false,
  onToggleSelect,
  highlighted = false,
  compact = false,
  expanded = false,
  onToggleExpanded,
}: {
  transaction: Transaction;
  categories: Category[];
  onCategoryChange: (categoryId: string | null) => void;
  onTypeToggle: () => void;
  onCardTypeToggle: () => void;
  onNotesChange: (notes: string | null) => void;
  onDelete: () => void;
  selected?: boolean;
  onToggleSelect?: () => void;
  highlighted?: boolean;
  compact?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: transaction.id,
  });

  return (
    <div
      ref={setNodeRef}
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
        onDelete={onDelete}
        selected={selected}
        onToggleSelect={onToggleSelect}
        highlighted={highlighted}
        compact={compact}
        expanded={expanded}
        onToggleExpanded={onToggleExpanded}
      />
    </div>
  );
}
