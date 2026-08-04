"use client";

import { useState } from "react";
import { CreditCard, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAmount, formatDate, formatTxType } from "@/lib/format";
import { flattenWithDepth } from "@/lib/category-tree";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

const UNCATEGORIZED_VALUE = "__uncategorized__";

export function TransactionCard({
  transaction,
  categories,
  onCategoryChange,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
  onDelete,
  selected = false,
  onToggleSelect,
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
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(transaction.notes ?? "");

  const selectedCategoryName =
    categories.find((c) => c.id === transaction.category_id)?.name ?? "Uncategorized";

  function saveNote() {
    setEditingNote(false);
    const trimmed = noteDraft.trim();
    if (trimmed !== (transaction.notes ?? "")) {
      onNotesChange(trimmed || null);
    }
  }

  return (
    <Card className={cn("flex flex-col gap-1.5 p-2", selected && "ring-2 ring-primary")}>
      <div className="flex items-start gap-1.5 border-b border-border/60 pb-1.5">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select transaction"
            className="mt-0.5 size-3.5 shrink-0 cursor-pointer accent-primary"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">{transaction.description}</p>
          {transaction.location && (
            <p className="truncate text-[11px] text-muted-foreground">{transaction.location}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{formatDate(transaction.date)}</span>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            transaction.amount < 0 ? "text-red-600" : "text-green-600",
          )}
        >
          {formatAmount(transaction.amount)}
        </span>
      </div>

      <Select
        value={transaction.category_id ?? UNCATEGORIZED_VALUE}
        onValueChange={(value) =>
          onCategoryChange(value === UNCATEGORIZED_VALUE ? null : value)
        }
      >
        <SelectTrigger
          className={cn(
            "h-7 w-full text-[11px]",
            !transaction.category_id && "border-destructive/40 text-destructive",
          )}
        >
          <SelectValue placeholder="Category">{selectedCategoryName}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNCATEGORIZED_VALUE}>Uncategorized</SelectItem>
          {flattenWithDepth(categories).map(({ category: c, depth }) => (
            <SelectItem
              key={c.id}
              value={c.id}
              className={depth > 0 ? "pl-6 text-muted-foreground" : undefined}
            >
              {depth > 0 ? `↳ ${c.name}` : c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={onTypeToggle}
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-muted",
            transaction.type === "need_review" && "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {formatTxType(transaction.type)}
        </button>

        <button
          type="button"
          onClick={onCardTypeToggle}
          className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize transition-colors hover:bg-muted"
        >
          <CreditCard className="size-2.5" />
          {transaction.card_type}
        </button>

        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete transaction"
          className="ml-auto shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      {editingNote ? (
        <textarea
          autoFocus
          rows={2}
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={saveNote}
          placeholder="Add a note…"
          className="w-full rounded-lg border border-input bg-transparent p-1.5 text-[11px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      ) : transaction.notes ? (
        <button
          type="button"
          onClick={() => setEditingNote(true)}
          className="rounded-lg bg-muted/60 p-1.5 text-left text-[11px] text-muted-foreground italic hover:text-foreground"
        >
          {transaction.notes}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditingNote(true)}
          className="self-start text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          + Add note
        </button>
      )}
    </Card>
  );
}
