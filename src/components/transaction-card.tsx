"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatAmount, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

export function TransactionCard({
  transaction,
  categories,
  onCategoryChange,
  onTypeToggle,
}: {
  transaction: Transaction;
  categories: Category[];
  onCategoryChange: (categoryId: string | null) => void;
  onTypeToggle: () => void;
}) {
  return (
    <Card className="flex flex-row items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{formatDate(transaction.date)}</span>
          {!transaction.category_id && (
            <Badge variant="destructive" className="text-xs">
              Uncategorized
            </Badge>
          )}
        </div>
        <p className="truncate font-medium">{transaction.description}</p>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "font-semibold tabular-nums",
            transaction.amount < 0 ? "text-red-600" : "text-green-600",
          )}
        >
          {formatAmount(transaction.amount)}
        </span>

        <Select
          value={transaction.category_id ?? undefined}
          onValueChange={(value) => onCategoryChange(value)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={onTypeToggle}
          className="rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors hover:bg-muted"
        >
          {transaction.type}
        </button>
      </div>
    </Card>
  );
}
