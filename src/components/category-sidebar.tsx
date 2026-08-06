"use client";

import { formatSpend } from "@/lib/format";
import { NEUTRAL_SWATCH, type CategorySwatch } from "@/lib/category-colors";
import { cn } from "@/lib/utils";
import type { CategorySlice } from "@/lib/overview";

export type CategoryFilter =
  | { kind: "all" }
  | { kind: "uncategorized" }
  | { kind: "category"; sliceId: string; categoryIds: string[]; name: string };

/**
 * "Where it went" as navigation, not just a readout: clicking a row scopes the
 * transaction list to that category. "All transactions" resets it, and
 * "Uncategorized" is pinned below the ranked list rather than folded into it,
 * since it isn't part of the spend ranking — it's the pool everything else
 * came out of.
 */
export function CategorySidebar({
  breakdown,
  totalCount,
  uncategorizedCount,
  uncategorizedSpent,
  colorMap,
  filter,
  onSelectFilter,
}: {
  breakdown: CategorySlice[];
  totalCount: number;
  uncategorizedCount: number;
  uncategorizedSpent: number;
  /** Same map the board's kanban columns use, so a category's color matches
   *  between the two views instead of being re-derived from this list's rank. */
  colorMap: Map<string, CategorySwatch>;
  filter: CategoryFilter;
  onSelectFilter: (filter: CategoryFilter) => void;
}) {
  const max = Math.max(1, ...breakdown.map((s) => s.spent));

  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Where it went
      </h2>

      <button
        type="button"
        onClick={() => onSelectFilter({ kind: "all" })}
        className={cn(
          "flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm font-medium transition-colors",
          filter.kind === "all" ? "border-primary ring-1 ring-primary" : "border-border/60 hover:border-border",
        )}
      >
        <span>All transactions</span>
        <span className="text-muted-foreground tabular-nums">{totalCount}</span>
      </button>

      {breakdown.map((slice) => {
        const swatch = colorMap.get(slice.id) ?? NEUTRAL_SWATCH;
        const active = filter.kind === "category" && filter.sliceId === slice.id;

        return (
          <button
            key={slice.id}
            type="button"
            onClick={() =>
              onSelectFilter(
                active
                  ? { kind: "all" }
                  : { kind: "category", sliceId: slice.id, categoryIds: slice.categoryIds, name: slice.name },
              )
            }
            className={cn(
              "flex flex-col gap-1 rounded-lg border bg-card px-3 py-1.5 text-left transition-colors",
              active ? cn("border-transparent ring-2", swatch.ring) : "border-border/60 hover:border-border",
            )}
          >
            <div className="flex items-baseline gap-2">
              <span className={cn("size-1.5 shrink-0 rounded-full", swatch.bar)} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{slice.name}</span>
              <span className={cn("shrink-0 text-xs font-semibold tabular-nums", swatch.text)}>
                {Math.round(slice.share * 100)}%
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatSpend(slice.spent)}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {slice.transactionCount}
              </span>
            </div>

            <div className="h-1 w-full overflow-hidden rounded-full bg-chart-track">
              <div
                className={cn("h-full rounded-r-full", swatch.bar)}
                style={{ width: `${Math.max((slice.spent / max) * 100, 1.5)}%` }}
              />
            </div>
          </button>
        );
      })}

      {uncategorizedCount > 0 && (
        <button
          type="button"
          onClick={() => onSelectFilter(filter.kind === "uncategorized" ? { kind: "all" } : { kind: "uncategorized" })}
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-left transition-colors",
            filter.kind === "uncategorized"
              ? "border-primary ring-1 ring-primary"
              : "border-border/60 hover:border-border",
          )}
        >
          <span className="text-sm font-medium text-primary">Uncategorized</span>
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tabular-nums">{formatSpend(uncategorizedSpent)}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{uncategorizedCount}</span>
          </span>
        </button>
      )}
    </section>
  );
}
