"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { computeTotals } from "@/lib/totals";
import { formatTxType } from "@/lib/format";
import { SummaryBar } from "@/components/summary-bar";
import { TransactionCard } from "@/components/transaction-card";
import { CategoryBoard } from "@/components/category-board";
import { CategorizeScreen } from "@/components/categorize-screen";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { Button } from "@/components/ui/button";
import type { Category, Transaction, TxType, CardType } from "@/lib/types";

export function TransactionBoard({
  initialTransactions,
  categories,
}: {
  initialTransactions: Transaction[];
  categories: Category[];
}) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [categorizing, setCategorizing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  function patchManyLocal(ids: string[], patch: Partial<Transaction>) {
    const idSet = new Set(ids);
    setTransactions((prev) => prev.map((t) => (idSet.has(t.id) ? { ...t, ...patch } : t)));
  }

  async function bulkUpdate(ids: string[], patch: Partial<Transaction>, successMessage: string) {
    const previous = transactions.filter((t) => ids.includes(t.id));
    patchManyLocal(ids, patch);

    const { error } = await supabase.from("transactions").update(patch).in("id", ids);

    if (error) {
      setTransactions((prev) =>
        prev.map((t) => previous.find((p) => p.id === t.id) ?? t),
      );
      toast.error("Failed to update selected transactions.");
      return;
    }

    toast.success(successMessage);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
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

  function handleCategoryChangeMulti(ids: string[], categoryId: string | null) {
    const categoryName = categoryId
      ? (categories.find((c) => c.id === categoryId)?.name ?? "Uncategorized")
      : "Uncategorized";

    void bulkUpdate(
      ids,
      { category_id: categoryId },
      `Moved ${ids.length} transactions to ${categoryName}`,
    );
    clearSelection();
  }

  function handleTypeToggle(id: string, currentType: TxType) {
    const cycle: TxType[] = ["personal", "common", "need_review"];
    const nextType = cycle[(cycle.indexOf(currentType) + 1) % cycle.length];
    void updateTransaction(id, { type: nextType });
  }

  function handleTypeChangeMulti(ids: string[], type: TxType) {
    void bulkUpdate(ids, { type }, `Set ${ids.length} transactions to ${formatTxType(type)}`);
    clearSelection();
  }

  function handleCardTypeToggle(id: string, currentCardType: CardType) {
    void updateTransaction(id, {
      card_type: currentCardType === "credit" ? "regular" : "credit",
    });
  }

  function handleCardTypeChangeMulti(ids: string[], cardType: CardType) {
    void bulkUpdate(ids, { card_type: cardType }, `Set ${ids.length} transactions to ${cardType}`);
    clearSelection();
  }

  function handleNotesChange(id: string, notes: string | null) {
    void updateTransaction(id, { notes });
  }

  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1));
  const uncategorized = sorted.filter((t) => !t.category_id);

  return (
    <div className={selectedIds.size > 0 ? "flex flex-col gap-6 pb-16" : "flex flex-col gap-6"}>
      <SummaryBar
        common={totals.common}
        personal={totals.personal}
        needReview={totals.needReview}
        overall={totals.overall}
        uncategorizedCount={totals.uncategorizedCount}
        needReviewCount={totals.needReviewCount}
      />

      {totals.uncategorizedCount > 0 && (
        <Button onClick={() => setCategorizing(true)} className="self-start">
          Categorize {totals.uncategorizedCount} uncategorized
        </Button>
      )}

      {categorizing && (
        <CategorizeScreen
          transactions={uncategorized}
          categories={categories}
          onCategoryChange={handleCategoryChange}
          onTypeToggle={handleTypeToggle}
          onCardTypeToggle={handleCardTypeToggle}
          onNotesChange={handleNotesChange}
          onClose={() => setCategorizing(false)}
        />
      )}

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No transactions yet for this month. Upload a statement above to get started.
        </p>
      ) : (
        <>
          {/* Desktop: drag-and-drop category columns. Selecting multiple cards and
              dragging any one of them moves the whole selection. */}
          <CategoryBoard
            transactions={sorted}
            categories={categories}
            onCategoryChange={handleCategoryChange}
            onCategoryChangeMulti={handleCategoryChangeMulti}
            onTypeToggle={handleTypeToggle}
            onCardTypeToggle={handleCardTypeToggle}
            onNotesChange={handleNotesChange}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
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
                onCardTypeToggle={() => handleCardTypeToggle(t.id, t.card_type)}
                onNotesChange={(notes) => handleNotesChange(t.id, notes)}
                selected={selectedIds.has(t.id)}
                onToggleSelect={() => toggleSelect(t.id)}
              />
            ))}
          </div>
        </>
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          categories={categories}
          onCategoryChange={(categoryId) =>
            handleCategoryChangeMulti(Array.from(selectedIds), categoryId)
          }
          onTypeChange={(type) => handleTypeChangeMulti(Array.from(selectedIds), type)}
          onCardTypeChange={(cardType) =>
            handleCardTypeChangeMulti(Array.from(selectedIds), cardType)
          }
          onClear={clearSelection}
        />
      )}
    </div>
  );
}
