"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TransactionList } from "@/components/transaction-list";
import { SimilarTransactionsDialog } from "@/components/similar-transactions-dialog";
import { CreateRuleDialog } from "@/components/create-rule-dialog";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { useTransactionActions } from "@/hooks/use-transaction-actions";
import { formatSpend } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

const EMPTY_SET = new Set<string>();

/** Step 2 of the settlement flow: the current user's own transactions for
 * one invoice, split into Personal/Common (plus a Need-review call-out),
 * editable via the same TransactionList/useTransactionActions pair the
 * overview and categorize screens already use — so category/type/card-type/
 * notes/delete behave identically everywhere in the app. */
export function SettlementReviewStep({
  invoiceLabel,
  transactions,
  categories,
  onConfirm,
}: {
  invoiceLabel: string;
  transactions: Transaction[];
  categories: Category[];
  onConfirm: () => void;
}) {
  const actions = useTransactionActions(transactions, categories);

  const { personal, common, needReview } = useMemo(() => {
    const personal: Transaction[] = [];
    const common: Transaction[] = [];
    const needReview: Transaction[] = [];
    for (const t of actions.transactions) {
      if (t.type === "personal") personal.push(t);
      else if (t.type === "common") common.push(t);
      else needReview.push(t);
    }
    return { personal, common, needReview };
  }, [actions.transactions]);

  const spend = (list: Transaction[]) =>
    list.reduce((sum, t) => sum + (t.amount < 0 ? -t.amount : 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-heading text-lg font-bold">Review your transactions</h3>
        <p className="text-sm text-muted-foreground">{invoiceLabel}</p>
      </div>

      {needReview.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-500">
              <AlertTriangle className="size-4" />
              {needReview.length} transaction{needReview.length > 1 ? "s" : ""} still need
              {needReview.length > 1 ? "" : "s"} review
            </CardTitle>
            <CardDescription>
              Mark each as Personal or Common before you can confirm.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransactionList
              transactions={needReview}
              categories={categories}
              selectedIds={EMPTY_SET}
              highlightedIds={EMPTY_SET}
              filterChip={null}
              hideSelection
              bare
              onToggleSelect={() => {}}
              onCategoryChange={actions.handleCategoryChange}
              onTypeToggle={actions.handleTypeToggle}
              onCardTypeToggle={actions.handleCardTypeToggle}
              onNotesChange={actions.handleNotesChange}
              onDelete={actions.handleDeleteTransaction}
            />
          </CardContent>
        </Card>
      )}

      {/* Transaction rows need real width to avoid truncating descriptions —
          this section sits inside the sidebar+detail split, which already
          eats a lot of the page's max-w-4xl, so Personal/Common only go
          side-by-side once there's genuinely enough room (unlike the
          simpler stat cards in the summary step, which split at `sm:`). */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard type="personal" total={spend(personal)} count={personal.length}>
          <TransactionList
            transactions={personal}
            categories={categories}
            selectedIds={EMPTY_SET}
            highlightedIds={EMPTY_SET}
            filterChip={null}
            hideSelection
            bare
            onToggleSelect={() => {}}
            onCategoryChange={actions.handleCategoryChange}
            onTypeToggle={actions.handleTypeToggle}
            onCardTypeToggle={actions.handleCardTypeToggle}
            onNotesChange={actions.handleNotesChange}
            onDelete={actions.handleDeleteTransaction}
          />
        </SectionCard>

        <SectionCard type="common" total={spend(common)} count={common.length}>
          <TransactionList
            transactions={common}
            categories={categories}
            selectedIds={EMPTY_SET}
            highlightedIds={EMPTY_SET}
            filterChip={null}
            hideSelection
            bare
            onToggleSelect={() => {}}
            onCategoryChange={actions.handleCategoryChange}
            onTypeToggle={actions.handleTypeToggle}
            onCardTypeToggle={actions.handleCardTypeToggle}
            onNotesChange={actions.handleNotesChange}
            onDelete={actions.handleDeleteTransaction}
          />
        </SectionCard>
      </div>

      <Card>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">
            Are all your transactions correctly marked as Personal or Common?
          </p>
          <Button disabled={needReview.length > 0} onClick={onConfirm}>
            Confirm my transactions
          </Button>
        </CardContent>
      </Card>

      <SimilarTransactionsDialog
        pending={actions.pendingSimilarMove}
        categories={categories}
        onConfirm={actions.confirmSimilarMove}
        onDismiss={actions.dismissSimilarMove}
      />
      <CreateRuleDialog
        pending={actions.pendingRulePrompt}
        onConfirm={actions.confirmCreateRule}
        onDismiss={actions.dismissCreateRule}
      />
      <DeleteConfirmDialog
        pending={actions.pendingDelete}
        onConfirm={actions.confirmDelete}
        onDismiss={actions.dismissDelete}
      />
    </div>
  );
}

function SectionCard({
  type,
  total,
  count,
  children,
}: {
  type: "common" | "personal";
  total: number;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card className={type === "common" ? "border-chart-1/30" : "border-chart-2/30"}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <span
              className={cn("size-2.5 shrink-0 rounded-full", type === "common" ? "bg-chart-1" : "bg-chart-2")}
            />
            {type === "common" ? "Common" : "Personal"}
          </CardTitle>
          <Badge variant="outline">{count}</Badge>
        </div>
        <p className="font-heading text-2xl font-bold">{formatSpend(total)}</p>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
