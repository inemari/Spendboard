"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { computeTotals } from "@/lib/totals";
import { SummaryBar } from "@/components/summary-bar";
import { TransactionCard } from "@/components/transaction-card";
import { CategoryBoard } from "@/components/category-board";
import { ReviewMode } from "@/components/review-mode";
import { Button } from "@/components/ui/button";
import type { Category, Transaction, TxType } from "@/lib/types";

export function TransactionBoard({
  initialTransactions,
  categories,
}: {
  initialTransactions: Transaction[];
  categories: Category[];
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [reviewing, setReviewing] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const totals = useMemo(() => computeTotals(transactions, categories), [transactions, categories]);

  function patchLocal(id: string, patch: Partial<Transaction>) {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function updateTransaction(id: string, patch: Partial<Transaction>) {
    const previous = transactions.find((t) => t.id === id);
    patchLocal(id, patch);

    const { error } = await supabase.from("transactions").update(patch).eq("id", id);

    if (error && previous) {
      patchLocal(id, previous);
      toast.error("Failed to save change.");
    }
  }

  function handleCategoryChange(id: string, categoryId: string | null) {
    const previousCategoryId = transactions.find((t) => t.id === id)?.category_id ?? null;
    if (previousCategoryId === categoryId) return;

    void updateTransaction(id, { category_id: categoryId });

    const categoryName = categoryId
      ? (categories.find((c) => c.id === categoryId)?.name ?? "Uncategorized")
      : "Uncategorized";

    toast.success(`Moved to ${categoryName}`, {
      action: {
        label: "Undo",
        onClick: () => void updateTransaction(id, { category_id: previousCategoryId }),
      },
    });
  }

  function handleTypeToggle(id: string, currentType: TxType) {
    const nextType: TxType = currentType === "common" ? "personal" : "common";
    void updateTransaction(id, { type: nextType });
  }

  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const uncategorized = sorted.filter((t) => !t.category_id);

  return (
    <div className="flex flex-col gap-6">
      <SummaryBar
        common={totals.common}
        personal={totals.personal}
        overall={totals.overall}
        uncategorizedCount={totals.uncategorizedCount}
      />

      {totals.uncategorizedCount > 0 && (
        <Button onClick={() => setReviewing(true)} className="self-start">
          Review {totals.uncategorizedCount} uncategorized
        </Button>
      )}

      {reviewing && (
        <ReviewMode
          transactions={uncategorized}
          categories={categories}
          onCategoryChange={handleCategoryChange}
          onTypeToggle={handleTypeToggle}
          onClose={() => setReviewing(false)}
        />
      )}

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No transactions yet for this month. Upload a statement above to get started.
        </p>
      ) : (
        <>
          {/* Desktop: drag-and-drop category columns */}
          <CategoryBoard
            transactions={sorted}
            categories={categories}
            onCategoryChange={handleCategoryChange}
            onTypeToggle={handleTypeToggle}
          />

          {/* Mobile: flat list, categorize via dropdown */}
          <div className="flex flex-col gap-2 md:hidden">
            {sorted.map((t) => (
              <TransactionCard
                key={t.id}
                transaction={t}
                categories={categories}
                onCategoryChange={(categoryId) => handleCategoryChange(t.id, categoryId)}
                onTypeToggle={() => handleTypeToggle(t.id, t.type)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
