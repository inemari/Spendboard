"use client";

import type { ReactNode } from "react";
import { CircleDashed, Layers, type LucideIcon } from "lucide-react";
import { formatSpend } from "@/lib/format";
import { NEUTRAL_SWATCH, UNCATEGORIZED_SWATCH, type CategorySwatch } from "@/lib/category-colors";
import { categoryIcon } from "@/lib/category-icons";
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
    <section className="flex flex-col gap-1">
      <h2 className="px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Where it went
      </h2>

      <SidebarRow
        icon={Layers}
        swatch={NEUTRAL_SWATCH}
        name="All transactions"
        active={filter.kind === "all"}
        trailing={<span className="text-sm text-muted-foreground tabular-nums">{totalCount}</span>}
        onClick={() => onSelectFilter({ kind: "all" })}
      />

      {breakdown.map((slice) => {
        const swatch = colorMap.get(slice.id) ?? NEUTRAL_SWATCH;
        const active = filter.kind === "category" && filter.sliceId === slice.id;

        return (
          <SidebarRow
            key={slice.id}
            icon={categoryIcon(slice.icon, slice.name)}
            swatch={swatch}
            name={slice.name}
            active={active}
            trailing={
              <span className="text-sm font-semibold tabular-nums">{formatSpend(slice.spent)}</span>
            }
            meter={{ fraction: slice.spent / max, share: slice.share, count: slice.transactionCount }}
            onClick={() =>
              onSelectFilter(
                active
                  ? { kind: "all" }
                  : { kind: "category", sliceId: slice.id, categoryIds: slice.categoryIds, name: slice.name },
              )
            }
          />
        );
      })}

      {uncategorizedCount > 0 && (
        <SidebarRow
          icon={CircleDashed}
          swatch={UNCATEGORIZED_SWATCH}
          name="Uncategorized"
          active={filter.kind === "uncategorized"}
          trailing={
            <span className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tabular-nums">{formatSpend(uncategorizedSpent)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{uncategorizedCount}</span>
            </span>
          }
          onClick={() =>
            onSelectFilter(filter.kind === "uncategorized" ? { kind: "all" } : { kind: "uncategorized" })
          }
        />
      )}
    </section>
  );
}

/**
 * One row: a pastel icon badge in the category's own color, the name and
 * amount on the top line, and (for real categories) the spend meter tucked
 * under them. Extracted because all three row kinds — All, a category, and
 * Uncategorized — are the same shape, and they were drifting apart when each
 * was written out inline.
 */
function SidebarRow({
  icon: Icon,
  swatch,
  name,
  active,
  trailing,
  meter,
  onClick,
}: {
  icon: LucideIcon;
  swatch: CategorySwatch;
  name: string;
  active: boolean;
  trailing: ReactNode;
  /** Omitted by the rows that aren't part of the spend ranking. */
  meter?: { fraction: number; share: number; count: number };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-2.5 py-2 text-left transition-colors",
        active ? cn("border-transparent ring-2", swatch.ring) : "border-transparent hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          swatch.badge,
        )}
      >
        <Icon className="size-4.5" strokeWidth={2} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold" title={name}>
            {name}
          </span>
          <span className="shrink-0">{trailing}</span>
        </span>

        {meter && (
          <span className="flex items-center gap-2">
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-chart-track">
              <span
                className={cn("block h-full rounded-full", swatch.bar)}
                style={{ width: `${Math.max(meter.fraction * 100, 2)}%` }}
              />
            </span>
            <span className={cn("shrink-0 text-[11px] font-semibold tabular-nums", swatch.text)}>
              {Math.round(meter.share * 100)}%
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {meter.count}
            </span>
          </span>
        )}
      </span>
    </button>
  );
}
