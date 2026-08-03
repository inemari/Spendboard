"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAmount, formatDate } from "@/lib/format";
import { flattenWithDepth } from "@/lib/category-tree";
import { cn } from "@/lib/utils";
import type { Category, Transaction, TxType } from "@/lib/types";

const UNCATEGORIZED_VALUE = "__uncategorized__";

function typeLabel(type: TxType): string {
  return type === "need_review" ? "Need review" : type[0].toUpperCase() + type.slice(1);
}

export function TransactionCard({
  transaction,
  categories,
  onCategoryChange,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
}: {
  transaction: Transaction;
  categories: Category[];
  onCategoryChange: (categoryId: string | null) => void;
  onTypeToggle: () => void;
  onCardTypeToggle: () => void;
  onNotesChange: (notes: string | null) => void;
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
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{transaction.description}</p>
          {transaction.location && (
            <p className="truncate text-xs text-muted-foreground">{transaction.location}</p>
          )}
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(transaction.date)}</span>
            {!transaction.category_id && (
              <Badge variant="destructive" className="text-[10px]">
                Uncategorized
              </Badge>
            )}
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            transaction.amount < 0 ? "text-red-600" : "text-green-600",
          )}
        >
          {formatAmount(transaction.amount)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={transaction.category_id ?? UNCATEGORIZED_VALUE}
          onValueChange={(value) =>
            onCategoryChange(value === UNCATEGORIZED_VALUE ? null : value)
          }
        >
          <SelectTrigger className="h-8 flex-1 text-xs">
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
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onTypeToggle}
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted",
            transaction.type === "need_review" && "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {typeLabel(transaction.type)}
        </button>

        <button
          type="button"
          onClick={onCardTypeToggle}
          className="flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors hover:bg-muted"
        >
          <CreditCard className="size-3" />
          {transaction.card_type}
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
          className="w-full rounded-lg border border-input bg-transparent p-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      ) : transaction.notes ? (
        <button
          type="button"
          onClick={() => setEditingNote(true)}
          className="rounded-lg bg-muted/60 p-2 text-left text-xs text-muted-foreground italic hover:text-foreground"
        >
          {transaction.notes}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditingNote(true)}
          className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          + Add note
        </button>
      )}
    </Card>
  );
}
