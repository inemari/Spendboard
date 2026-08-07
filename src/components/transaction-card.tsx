"use client";

import { useState } from "react";
import { ChevronDown, CreditCard, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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
  /** Drop the category/type/card-type/delete controls, keeping identity fields
   *  and notes. Used on the board, where a card's job is to be dragged rather
   *  than edited — that control set stays one click away in the overview list.
   *  Notes are kept because, unlike those controls, there's no other surface
   *  where a board card's note is visible. */
  compact?: boolean;
  /** Compact-only: collapsed shows just name/date/amount; expanded reveals
   *  location, type/card-type, and notes. Ignored outside `compact`. */
  expanded?: boolean;
  onToggleExpanded?: () => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(transaction.notes ?? "");

  const selectedCategoryName =
    categories.find((c) => c.id === transaction.category_id)?.name ??
    "Uncategorized";

  function saveNote() {
    setEditingNote(false);
    const trimmed = noteDraft.trim();
    if (trimmed !== (transaction.notes ?? "")) {
      onNotesChange(trimmed || null);
    }
  }

  return (
    <Card
      id={`transaction-${transaction.id}`}
      className={cn(
        "flex flex-col p-3 transition-shadow group",
        compact ? "gap-0.5 p-2" : "gap-1",
        selected && "ring-2 ring-primary",
        highlighted && "ring-2 ring-amber-500 shadow-lg shadow-amber-500/30",
      )}
    >
      <div
        className={cn(
          "flex items-start gap-2",
          !compact && "border-b border-border/60 pb-1.5",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold">
            {transaction.description}
          </p>
          {/* Collapsed compact cards show only name/date/amount — location
              only appears once expanded, alongside the other detail fields. */}
          {(!compact || expanded) && transaction.location && (
            <p className="truncate text-[11px] text-muted-foreground">
              {transaction.location}
            </p>
          )}
        </div>{" "}
        {onToggleSelect && (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label="Select transaction"
            className="mt-0.5 size-3 shrink-0 cursor-pointer opacity-0 group-hover:opacity-100"
          />
        )}
        {/* The only click target for expanding — its own padded hit area, kept
            apart from the checkbox above so the two aren't easy to fat-finger. */}
        {compact && (
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-label={expanded ? "Collapse" : "Expand"}
            aria-expanded={expanded}
            className="-m-1 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronDown
              className={cn("size-3 transition-transform", expanded && "rotate-180")}
            />
          </button>
        )}
      </div>
      {!compact && (
        <>
          <Select
            value={transaction.category_id ?? UNCATEGORIZED_VALUE}
            onValueChange={(value) =>
              onCategoryChange(value === UNCATEGORIZED_VALUE ? null : value)
            }
          >
            <SelectTrigger
              className={cn(
                "h-7 w-full text-[11px]",
                !transaction.category_id &&
                  "border-destructive/40 text-destructive",
              )}
            >
              <SelectValue placeholder="Category">
                {selectedCategoryName}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNCATEGORIZED_VALUE}>Uncategorized</SelectItem>
              {flattenWithDepth(categories).map(({ category: c, depth }) => (
                <SelectItem
                  key={c.id}
                  value={c.id}
                  className={
                    depth > 0 ? "pl-6 text-muted-foreground" : undefined
                  }
                >
                  {depth > 0 ? `↳ ${c.name}` : c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete transaction"
              className="ml-auto shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        </>
      )}
      {/* The rest of a compact card's fields — type/card-type and notes —
          only render once expanded, so a collapsed card is just name/date/amount. */}
      {(!compact || expanded) && (
        <>
          <div className={cn("flex flex-row", compact && "gap-1")}>
            <button
              type="button"
              onClick={onTypeToggle}
              className={cn(
                "shrink-0 rounded-full border font-medium transition-colors hover:bg-muted",
                compact ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]",
                transaction.type === "need_review" &&
                  "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              {formatTxType(transaction.type)}
            </button>
            <button
              type="button"
              onClick={onCardTypeToggle}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border font-medium capitalize transition-colors hover:bg-muted",
                compact ? "px-1.5 py-px text-[10px]" : "px-2 py-0.5 text-[11px]",
              )}
            >
              <CreditCard className="size-2.5" />
              {transaction.card_type}
            </button>
          </div>
          {/* Notes stay available even in compact (board) cards — unlike category/type,
              which are one click away in the overview list, there's no other surface
              where a board card's note is visible or editable. */}
          {editingNote ? (
            <Textarea
              autoFocus
              rows={2}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={saveNote}
              placeholder="Add a note…"
              className="min-h-0 p-1.5 text-[11px]"
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
              className={cn(
                "group-hover:opacity-100 opacity-0 self-start text-muted-foreground underline underline-offset-2 hover:text-foreground",
                compact ? "text-[10px]" : "text-[11px]",
              )}
            >
              + Add note
            </button>
          )}
        </>
      )}
      <div
        className={cn(
          "flex items-center justify-between gap-2 text-muted-foreground",
          compact ? "text-[10px]" : "text-[11px]",
        )}
      >
        <span>{formatDate(transaction.date)}</span>
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            transaction.amount < 0 ? "text-primary" : "text-green-600",
          )}
        >
          {formatAmount(transaction.amount)}
        </span>
      </div>
    </Card>
  );
}
