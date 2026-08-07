"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { flattenWithDepth } from "@/lib/category-tree";
import { formatTxType } from "@/lib/format";
import type { Category, CardType, TxType } from "@/lib/types";

const UNCATEGORIZED_VALUE = "__uncategorized__";
const TYPES: TxType[] = ["personal", "common", "need_review"];
const CARD_TYPES: CardType[] = ["credit", "debit"];

export function BulkActionBar({
  count,
  categories,
  onCategoryChange,
  onTypeChange,
  onCardTypeChange,
  onDelete,
  onClear,
}: {
  count: number;
  categories: Category[];
  onCategoryChange: (categoryId: string | null) => void;
  onTypeChange: (type: TxType) => void;
  onCardTypeChange: (cardType: CardType) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div className="mx-20 my-2 rounded-full fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center gap-2 border bg-card p-3  drop-shadow-lg border-primary">
      <span className="text-sm font-semibold">{count} selected</span>

      <Select
        onValueChange={(value: string | null) =>
          onCategoryChange(value === UNCATEGORIZED_VALUE ? null : value)
        }
      >
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue placeholder="Set category">
            {(value: string | null) => {
              if (!value || value === UNCATEGORIZED_VALUE)
                return "Set category";
              return (
                categories.find((c) => c.id === value)?.name ?? "Set category"
              );
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNCATEGORIZED_VALUE}>Uncategorized</SelectItem>
          {flattenWithDepth(categories).map(({ category: c, depth }) => (
            <SelectItem
              key={c.id}
              value={c.id}
              className={depth > 0 ? "pl-6 text-muted-foreground" : undefined}
            >
              {depth > 0 ? `↳ ${c.name}` : c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-1">
        {TYPES.map((type) => (
          <Button
            key={type}
            size="sm"
            variant="outline"
            onClick={() => onTypeChange(type)}
          >
            {formatTxType(type)}
          </Button>
        ))}
      </div>

      <div className="flex gap-1">
        {CARD_TYPES.map((cardType) => (
          <Button
            key={cardType}
            size="sm"
            variant="outline"
            className="capitalize"
            onClick={() => onCardTypeChange(cardType)}
          >
            {cardType}
          </Button>
        ))}
      </div>

      <Button
        size="sm"
        variant="outline"
        className="ml-auto text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
        Delete
      </Button>

      <Button size="sm" variant="ghost" onClick={onClear}>
        <X className="size-4" />
        Clear
      </Button>
    </div>
  );
}
