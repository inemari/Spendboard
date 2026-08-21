"use client";

import { createElement, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { computeTotals } from "@/lib/totals";
import { formatTxType } from "@/lib/format";
import { findSimilarTransactions, normalizeDescription } from "@/lib/similar-transactions";
import { findMergeTarget, mergeValuesIntoRule } from "@/lib/rule-merge";
import type { Category, CreditInvoice, Transaction, TxType, CardType, Rule } from "@/lib/types";

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

export type PendingDelete = { ids: string[] };

export function useTransactionActions(
  initialTransactions: Transaction[],
  categories: Category[],
  invoices: CreditInvoice[] = [],
  /** Invoices still eligible for retroactive (re)assignment — the same
   *  eligibility rule as the upload dialog's invoice picker. A transaction
   *  already tagged to an invoice outside this set (mid-settlement or
   *  completed) is left alone by the bulk handler rather than desynced from
   *  a settlement that's already in flight or frozen. */
  openInvoiceIds: Set<string> = new Set(),
) {
  const [transactions, setTransactions] = useState(initialTransactions);
  useEffect(() => setTransactions(initialTransactions), [initialTransactions]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingSimilarMove, setPendingSimilarMove] = useState<PendingSimilarMove | null>(null);
  const [pendingRulePrompt, setPendingRulePrompt] = useState<PendingRulePrompt | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const rulesHref = "/rules";

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

    // Fold into an existing "name equals" rule for this category instead of
    // creating a second rule for the same condition, if one already exists.
    const { data: existingRows, error: fetchError } = await supabase
      .from("rules")
      .select("id, category_id, conditions, type, is_default")
      .eq("category_id", categoryId);

    if (fetchError) {
      toast.error("Failed to create rule.");
      return;
    }

    const existingRules = (existingRows ?? []) as unknown as Rule[];
    // This flow never sets a type itself, so it only ever merges into
    // another plain (type-less) rule for the same condition — not into one
    // that also sets Common/Personal/Need review.
    const mergeTarget = findMergeTarget(existingRules, categoryId, "name", "equals", null);

    const error = mergeTarget
      ? (await supabase.from("rules").update({
          conditions: [mergeValuesIntoRule(mergeTarget, matchTexts)],
          is_default: false,
        }).eq("id", mergeTarget.id))
          .error
      : (
          await supabase.from("rules").insert({
            conditions: [{ field: "name" as const, operator: "equals" as const, values: matchTexts }],
            category_id: categoryId,
          })
        ).error;

    if (error) {
      toast.error("Failed to create rule.");
      return;
    }

    toast.success("Rule added", {
      icon: createElement(Wand2, { className: "size-4" }),
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
      card_type: currentCardType === "credit" ? "debit" : "credit",
    });
  }

  function handleCardTypeChangeMulti(ids: string[], cardType: CardType) {
    void bulkUpdate(ids, { card_type: cardType }, `Set ${ids.length} transactions to ${cardType}`);
    clearSelection();
  }

  function handleInvoiceChange(id: string, invoiceId: string | null) {
    const target = transactions.find((t) => t.id === id);
    const previousInvoiceId = target?.credit_invoice_id ?? null;
    if (previousInvoiceId === invoiceId) return;

    void updateTransaction(id, { credit_invoice_id: invoiceId });

    const label = invoiceId ? (invoices.find((i) => i.id === invoiceId)?.label ?? "settlement") : null;
    toast.success(label ? `Tagged to ${label}` : "Removed settlement tag", {
      action: {
        label: "Undo",
        onClick: () => void updateTransaction(id, { credit_invoice_id: previousInvoiceId }),
      },
    });
  }

  function handleInvoiceChangeMulti(ids: string[], invoiceId: string | null) {
    // Skip any transaction already tagged to an invoice that's mid-settlement
    // or completed — same eligibility rule as the single-transaction editor,
    // just applied per-row across the selection.
    const eligibleIds = ids.filter((id) => {
      const current = transactions.find((t) => t.id === id)?.credit_invoice_id ?? null;
      return !current || openInvoiceIds.has(current);
    });
    const skipped = ids.length - eligibleIds.length;

    if (eligibleIds.length === 0) {
      toast.error("Those transactions already belong to a settlement in progress.");
      clearSelection();
      return;
    }

    const label = invoiceId ? (invoices.find((i) => i.id === invoiceId)?.label ?? "settlement") : null;
    const skippedSuffix = skipped > 0 ? ` (${skipped} skipped — already in a settlement)` : "";
    void bulkUpdate(
      eligibleIds,
      { credit_invoice_id: invoiceId },
      (label
        ? `Tagged ${eligibleIds.length} transactions to ${label}`
        : `Removed settlement tag from ${eligibleIds.length} transactions`) + skippedSuffix,
    );
    clearSelection();
  }

  function handleNotesChange(id: string, notes: string | null) {
    void updateTransaction(id, { notes });
  }

  async function deleteTransaction(id: string) {
    const previous = transactions.find((t) => t.id === id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));

    const { error } = await supabase.from("transactions").delete().eq("id", id);

    if (error) {
      if (previous) setTransactions((prev) => [...prev, previous]);
      toast.error("Failed to delete transaction.");
      return;
    }

    toast.success("Transaction deleted");
  }

  function handleDeleteTransaction(id: string) {
    setPendingDelete({ ids: [id] });
  }

  async function deleteMulti(ids: string[]) {
    const previous = transactions.filter((t) => ids.includes(t.id));
    const idSet = new Set(ids);
    setTransactions((prev) => prev.filter((t) => !idSet.has(t.id)));

    const { error } = await supabase.from("transactions").delete().in("id", ids);

    if (error) {
      setTransactions((prev) => [...prev, ...previous]);
      toast.error("Failed to delete selected transactions.");
      return;
    }

    toast.success(`Deleted ${ids.length} transactions`);
  }

  function handleDeleteMulti(ids: string[]) {
    setPendingDelete({ ids });
  }

  function confirmDelete() {
    const pending = pendingDelete;
    setPendingDelete(null);
    if (!pending) return;

    if (pending.ids.length === 1) {
      void deleteTransaction(pending.ids[0]);
    } else {
      void deleteMulti(pending.ids);
      clearSelection();
    }
  }

  function dismissDelete() {
    setPendingDelete(null);
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
    handleInvoiceChange,
    handleInvoiceChangeMulti,
    handleNotesChange,
    handleDeleteTransaction,
    handleDeleteMulti,
    pendingSimilarMove,
    confirmSimilarMove,
    dismissSimilarMove,
    pendingRulePrompt,
    confirmCreateRule,
    dismissCreateRule,
    pendingDelete,
    confirmDelete,
    dismissDelete,
  };
}
