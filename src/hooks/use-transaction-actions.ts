"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { computeTotals } from "@/lib/totals";
import { formatTxType } from "@/lib/format";
import { findSimilarTransactions, normalizeDescription } from "@/lib/similar-transactions";
import type { Category, Transaction, TxType, CardType } from "@/lib/types";

export type PendingSimilarMove = {
  target: Transaction;
  categoryId: string;
  categoryName: string;
  candidates: Transaction[];
};

export type PendingRulePrompt = {
  rawNames: string[];
  categoryId: string;
  categoryName: string;
};

export function useTransactionActions(
  initialTransactions: Transaction[],
  categories: Category[],
) {
  const [transactions, setTransactions] = useState(initialTransactions);
  useEffect(() => setTransactions(initialTransactions), [initialTransactions]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingSimilarMove, setPendingSimilarMove] = useState<PendingSimilarMove | null>(null);
  const [pendingRulePrompt, setPendingRulePrompt] = useState<PendingRulePrompt | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const rulesHref = useMemo(() => {
    const [, year, month] = pathname.split("/");
    return `/${year}/${month}/rules`;
  }, [pathname]);

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
      setTransactions((prev) => prev.map((t) => previous.find((p) => p.id === t.id) ?? t));
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

  function toggleSelectAll(ids: string[]) {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function handleCategoryChange(id: string, categoryId: string | null) {
    const target = transactions.find((t) => t.id === id);
    const previousCategoryId = target?.category_id ?? null;
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

    if (categoryId && target) {
      const candidates = findSimilarTransactions(transactions, target, categoryId);
      if (candidates.length > 0) {
        setPendingSimilarMove({ target, categoryId, categoryName, candidates });
      }
    }
  }

  function confirmSimilarMove(selectedIds: string[]) {
    const pending = pendingSimilarMove;
    setPendingSimilarMove(null);
    if (!pending || selectedIds.length === 0) return;

    void bulkUpdate(
      selectedIds,
      { category_id: pending.categoryId },
      `Moved ${selectedIds.length} similar transactions to ${pending.categoryName}`,
    );

    const movedDescriptions = pending.candidates
      .filter((t) => selectedIds.includes(t.id))
      .map((t) => t.description);
    setPendingRulePrompt({
      rawNames: Array.from(new Set([pending.target.description, ...movedDescriptions])),
      categoryId: pending.categoryId,
      categoryName: pending.categoryName,
    });
  }

  function dismissSimilarMove() {
    setPendingSimilarMove(null);
  }

  function confirmCreateRule() {
    const pending = pendingRulePrompt;
    setPendingRulePrompt(null);
    if (!pending) return;
    void createRule(pending.rawNames, pending.categoryId);
  }

  function dismissCreateRule() {
    setPendingRulePrompt(null);
  }

  async function createRule(rawNames: string[], categoryId: string) {
    const matchTexts = Array.from(new Set(rawNames.map(normalizeDescription).filter(Boolean)));
    if (matchTexts.length === 0) return;

    const groups = [
      matchTexts.map((value) => ({ field: "name" as const, operator: "equals" as const, value })),
    ];

    const { error } = await supabase
      .from("rules")
      .insert({ conditions: groups, category_id: categoryId });

    if (error) {
      toast.error("Failed to create rule.");
      return;
    }

    toast.success("Rule added", {
      action: {
        label: "View rules",
        onClick: () => router.push(rulesHref),
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

  return {
    transactions,
    totals,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    handleCategoryChange,
    handleCategoryChangeMulti,
    handleTypeToggle,
    handleTypeChangeMulti,
    handleCardTypeToggle,
    handleCardTypeChangeMulti,
    handleNotesChange,
    pendingSimilarMove,
    confirmSimilarMove,
    dismissSimilarMove,
    pendingRulePrompt,
    confirmCreateRule,
    dismissCreateRule,
  };
}
