"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatAmount, formatDate } from "@/lib/format";
import type { PendingSimilarMove } from "@/hooks/use-transaction-actions";
import type { Category } from "@/lib/types";

export function SimilarTransactionsDialog({
  pending,
  categories,
  onConfirm,
  onDismiss,
}: {
  pending: PendingSimilarMove | null;
  categories: Category[];
  onConfirm: (selectedIds: string[]) => void;
  onDismiss: () => void;
}) {
  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && onDismiss()}>
      {pending && (
        <SimilarTransactionsDialogContent
          key={pending.target.id}
          pending={pending}
          categories={categories}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
        />
      )}
    </Dialog>
  );
}

function SimilarTransactionsDialogContent({
  pending,
  categories,
  onConfirm,
  onDismiss,
}: {
  pending: PendingSimilarMove;
  categories: Category[];
  onConfirm: (selectedIds: string[]) => void;
  onDismiss: () => void;
}) {
  const [selected, setSelected] = useState(
    () => new Set(pending.candidates.map((t) => t.id)),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Move similar transactions to {pending.categoryName}?</DialogTitle>
        <DialogDescription>
          Found {pending.candidates.length} other transaction
          {pending.candidates.length > 1 ? "s" : ""} with a similar name to &ldquo;
          {pending.target.description}&rdquo;.
        </DialogDescription>
      </DialogHeader>

      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {pending.candidates.map((t) => {
          const currentCategoryName =
            categories.find((c) => c.id === t.category_id)?.name ?? "Uncategorized";
          return (
            <label
              key={t.id}
              className="flex items-start gap-3 rounded-lg border p-2 text-sm has-checked:border-primary/50 has-checked:bg-primary/5"
            >
              <Checkbox
                checked={selected.has(t.id)}
                onCheckedChange={() => toggle(t.id)}
                className="mt-0.5 size-4 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.description}</p>
                    {t.location && (
                      <p className="truncate text-xs text-muted-foreground">{t.location}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{formatAmount(t.amount)}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(t.date)}</span>
                  <span>&middot;</span>
                  <span className="truncate">{currentCategoryName}</span>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDismiss}>
          Skip
        </Button>
        <Button disabled={selected.size === 0} onClick={() => onConfirm(Array.from(selected))}>
          Move {selected.size}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
