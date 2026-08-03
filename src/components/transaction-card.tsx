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

const UNCATEGORIZED_VALUE = "__uncategorized__";

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
    <Card className="flex flex-col gap-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{transaction.description}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(transaction.date)}</span>
            {!transaction.category_id && (
              <Badge variant="destructive" className="text-[10px]">
                Uncategorized
              </Badge>
            )}
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            transaction.amount < 0 ? "text-red-600" : "text-green-600",
          )}
        >
          {formatAmount(transaction.amount)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={transaction.category_id ?? UNCATEGORIZED_VALUE}
          onValueChange={(value) =>
            onCategoryChange(value === UNCATEGORIZED_VALUE ? null : value)
          }
        >
          <SelectTrigger className="h-8 flex-1 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNCATEGORIZED_VALUE}>Uncategorized</SelectItem>
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
          className="shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors hover:bg-muted"
        >
          {transaction.type}
        </button>
      </div>
    </Card>
  );
}
