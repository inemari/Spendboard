"use client";

import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatAmount, formatDate } from "@/lib/format";
import type { Category, Transaction } from "@/lib/types";

export function NewTransactionsSheet({
  transactions,
  categories,
  categorizeHref,
  onOpenChange,
}: {
  transactions: Transaction[] | null;
  categories: Category[];
  categorizeHref: string;
  onOpenChange: (open: boolean) => void;
}) {
  const sorted = [...(transactions ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
  const uncategorizedCount = sorted.filter((t) => !t.category_id).length;

  return (
    <Sheet open={transactions !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {sorted.length} new transaction{sorted.length !== 1 ? "s" : ""} imported
          </SheetTitle>
          {uncategorizedCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {uncategorizedCount} of them need categorizing.
            </p>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-2 overflow-y-auto p-4">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing new — every transaction in this file was already in this month.
            </p>
          ) : (
            sorted.map((t) => {
              const categoryName = categories.find((c) => c.id === t.category_id)?.name;
              return (
                <div key={t.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" title={t.description}>{t.description}</p>
                    {t.location && (
                      <p className="truncate text-xs text-muted-foreground" title={t.location}>{t.location}</p>
                    )}
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{formatDate(t.date)}</span>
                      <span>&middot;</span>
                      <span className={categoryName ? undefined : "text-destructive"}>
                        {categoryName ?? "Uncategorized"}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{formatAmount(t.amount)}</span>
                </div>
              );
            })
          )}
        </div>

        {uncategorizedCount > 0 && (
          <div className="p-4 pt-0">
            <Button className="w-full" nativeButton={false} render={<Link href={categorizeHref} />}>
              Categorize {uncategorizedCount} now
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
