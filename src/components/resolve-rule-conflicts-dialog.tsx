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
import { formatAmount, formatDate } from "@/lib/format";

export type RuleConflictOption = { categoryId: string; categoryName: string };

export type RuleConflictItem = {
  transaction: {
    id: string;
    description: string;
    location: string | null;
    amount: number;
    date: string;
  };
  options: RuleConflictOption[];
  defaultCategoryId: string;
};

export type PendingRuleConflicts = {
  items: RuleConflictItem[];
};

export function ResolveRuleConflictsDialog({
  pending,
  onConfirm,
  onDismiss,
}: {
  pending: PendingRuleConflicts | null;
  onConfirm: (selections: Map<string, string>) => void;
  onDismiss: () => void;
}) {
  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && onDismiss()}>
      {pending && (
        <ResolveRuleConflictsDialogContent
          key={pending.items.map((i) => i.transaction.id).join(",")}
          pending={pending}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
        />
      )}
    </Dialog>
  );
}

function ResolveRuleConflictsDialogContent({
  pending,
  onConfirm,
  onDismiss,
}: {
  pending: PendingRuleConflicts;
  onConfirm: (selections: Map<string, string>) => void;
  onDismiss: () => void;
}) {
  const [choices, setChoices] = useState<Map<string, string | null>>(
    () => new Map(pending.items.map((item) => [item.transaction.id, item.defaultCategoryId])),
  );

  const selectedCount = Array.from(choices.values()).filter((v) => v !== null).length;

  function setChoice(txId: string, categoryId: string | null) {
    setChoices((prev) => {
      const next = new Map(prev);
      next.set(txId, categoryId);
      return next;
    });
  }

  function handleConfirm() {
    const selections = new Map<string, string>();
    for (const [txId, categoryId] of choices) {
      if (categoryId !== null) selections.set(txId, categoryId);
    }
    onConfirm(selections);
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Multiple rules match {pending.items.length === 1 ? "this transaction" : `${pending.items.length} transactions`}</DialogTitle>
        <DialogDescription>
          Pick which category each one should get, or skip to leave it uncategorized.
        </DialogDescription>
      </DialogHeader>

      <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
        {pending.items.map(({ transaction: t, options }) => {
          const choice = choices.get(t.id) ?? null;
          return (
            <div key={t.id} className="rounded-lg border p-2.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium" title={t.description}>{t.description}</p>
                  {t.location && (
                    <p className="truncate text-xs text-muted-foreground" title={t.location}>{t.location}</p>
                  )}
                </div>
                <span className="shrink-0 font-semibold tabular-nums">{formatAmount(t.amount)}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(t.date)}</p>

              <div className="mt-2 flex flex-col gap-1.5">
                {options.map((option) => (
                  <label
                    key={option.categoryId}
                    className="flex items-center gap-2 rounded-md border px-2 py-1.5 has-checked:border-primary/50 has-checked:bg-primary/5"
                  >
                    <input
                      type="radio"
                      name={`choice-${t.id}`}
                      checked={choice === option.categoryId}
                      onChange={() => setChoice(t.id, option.categoryId)}
                      className="size-3.5 accent-primary"
                    />
                    <span className="truncate" title={option.categoryName}>{option.categoryName}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-muted-foreground has-checked:border-primary/50 has-checked:bg-primary/5">
                  <input
                    type="radio"
                    name={`choice-${t.id}`}
                    checked={choice === null}
                    onChange={() => setChoice(t.id, null)}
                    className="size-3.5 accent-primary"
                  />
                  <span>Skip &mdash; leave uncategorized</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDismiss}>
          Cancel
        </Button>
        <Button disabled={selectedCount === 0} onClick={handleConfirm}>
          Apply {selectedCount}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
