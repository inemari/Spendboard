"use client";

import { useMemo, useState } from "react";
import { ChevronDown, CreditCard, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatAmount,
  formatDayHeading,
  formatSpend,
  formatTxType,
} from "@/lib/format";
import { flattenWithDepth } from "@/lib/category-tree";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

const UNCATEGORIZED_VALUE = "__uncategorized__";

export type ActiveFilterChip = { label: string; className: string };

export function TransactionList({
  transactions,
  categories,
  selectedIds,
  highlightedIds,
  filterChip,
  onToggleSelect,
  onCategoryChange,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
  onDelete,
}: {
  transactions: Transaction[];
  categories: Category[];
  selectedIds: Set<string>;
  highlightedIds: Set<string>;
  /** Set by the category sidebar's active selection; null when scoped to "all". */
  filterChip: ActiveFilterChip | null;
  onToggleSelect: (id: string) => void;
  onCategoryChange: (id: string, categoryId: string | null) => void;
  onTypeToggle: (id: string, currentType: Transaction["type"]) => void;
  onCardTypeToggle: (
    id: string,
    currentCardType: Transaction["card_type"],
  ) => void;
  onNotesChange: (id: string, notes: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        (t.location?.toLowerCase().includes(q) ?? false),
    );
  }, [transactions, query]);

  // Group by day, newest first, so the list reads like a statement.
  const days = useMemo(() => {
    const byDate = new Map<string, Transaction[]>();
    for (const t of [...visible].sort((a, b) => (a.date < b.date ? 1 : -1))) {
      const bucket = byDate.get(t.date) ?? [];
      bucket.push(t);
      byDate.set(t.date, bucket);
    }
    return Array.from(byDate, ([date, items]) => ({
      date,
      items,
      spent: items.reduce((sum, t) => sum + (t.amount < 0 ? -t.amount : 0), 0),
    }));
  }, [visible]);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 font-heading text-base font-bold">
          Transactions
          {filterChip && (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                filterChip.className,
              )}
            >
              {filterChip.label}
            </span>
          )}
          <span className="text-sm font-normal text-muted-foreground">
            {visible.length}
          </span>
        </h2>

        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="h-8 w-full pl-8 text-xs sm:w-48"
          />
        </div>
      </div>

      {days.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {transactions.length === 0
            ? "No transactions yet this month. Upload a statement to get started."
            : "Nothing matches that search."}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {days.map((day) => (
            <div key={day.date} className="flex flex-col">
              <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
                <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {formatDayHeading(day.date)}
                </h3>
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                  {formatSpend(day.spent)}
                </span>
              </div>

              <ul>
                {day.items.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    categories={categories}
                    selected={selectedIds.has(t.id)}
                    highlighted={highlightedIds.has(t.id)}
                    expanded={expandedId === t.id}
                    onToggleExpanded={() =>
                      setExpandedId((prev) => (prev === t.id ? null : t.id))
                    }
                    onToggleSelect={() => onToggleSelect(t.id)}
                    onCategoryChange={(categoryId) =>
                      onCategoryChange(t.id, categoryId)
                    }
                    onTypeToggle={() => onTypeToggle(t.id, t.type)}
                    onCardTypeToggle={() => onCardTypeToggle(t.id, t.card_type)}
                    onNotesChange={(notes) => onNotesChange(t.id, notes)}
                    onDelete={() => onDelete(t.id)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TransactionRow({
  transaction: t,
  categories,
  selected,
  highlighted,
  expanded,
  onToggleExpanded,
  onToggleSelect,
  onCategoryChange,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
  onDelete,
}: {
  transaction: Transaction;
  categories: Category[];
  selected: boolean;
  highlighted: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleSelect: () => void;
  onCategoryChange: (categoryId: string | null) => void;
  onTypeToggle: () => void;
  onCardTypeToggle: () => void;
  onNotesChange: (notes: string | null) => void;
  onDelete: () => void;
}) {
  const [noteDraft, setNoteDraft] = useState(t.notes ?? "");
  const categoryName = categories.find((c) => c.id === t.category_id)?.name;

  function saveNote() {
    const trimmed = noteDraft.trim();
    if (trimmed !== (t.notes ?? "")) onNotesChange(trimmed || null);
  }

  return (
    <li
      id={`transaction-${t.id}`}
      className={cn(
        "group scroll-mt-24 rounded-xl transition-colors ",
        selected && "bg-primary/5",
        highlighted && "ring-2 ring-amber-500",
      )}
    >
      <div className="flex items-center gap-3 px-2 py-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${t.description}`}
          className={cn(
            "size-3.5 shrink-0 cursor-pointer accent-primary transition-opacity",
            !selected &&
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          )}
        />

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {t.description}
            </span>
            {t.location && (
              <span className="block truncate text-xs text-muted-foreground">
                {t.location}
              </span>
            )}
          </span>

          <span
            className={cn(
              "hidden shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium sm:inline",
              categoryName
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary",
            )}
          >
            {categoryName ?? "Uncategorized"}
          </span>

          <span
            className={cn(
              "shrink-0 text-sm font-semibold tabular-nums",
              t.amount > 0 && "text-green-600",
            )}
          >
            {formatAmount(t.amount)}
          </span>

          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 px-2 pb-3 pl-8">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={t.category_id ?? UNCATEGORIZED_VALUE}
              onValueChange={(value) =>
                onCategoryChange(value === UNCATEGORIZED_VALUE ? null : value)
              }
            >
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue>{categoryName ?? "Uncategorized"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCATEGORIZED_VALUE}>
                  Uncategorized
                </SelectItem>
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

            <button
              type="button"
              onClick={onTypeToggle}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-muted",
                t.type === "need_review" &&
                  "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              {formatTxType(t.type)}
            </button>

            <button
              type="button"
              onClick={onCardTypeToggle}
              className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors hover:bg-muted"
            >
              <CreditCard className="size-2.5" />
              {t.card_type}
            </button>

            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete transaction"
              className="ml-auto rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          <Input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={saveNote}
            placeholder="Add a note…"
            className="h-8 text-xs"
          />
        </div>
      )}
    </li>
  );
}
