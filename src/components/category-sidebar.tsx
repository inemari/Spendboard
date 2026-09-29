"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, CircleDashed, Layers, Search, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatSpend } from "@/lib/format";
import {
  NEUTRAL_SWATCH,
  UNCATEGORIZED_SWATCH,
  type CategorySwatch,
} from "@/lib/category-colors";
import { categoryIcon } from "@/lib/category-icons";
import { buildCategoryTree } from "@/lib/category-tree";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

export type CategoryFilter =
  | { kind: "all" }
  | { kind: "uncategorized" }
  | { kind: "category"; sliceId: string; categoryIds: string[]; name: string };

/** Category navigation and categorization target in one place. */
export function CategorySidebar({
  categories,
  transactions,
  totalCount,
  uncategorizedCount,
  uncategorizedSpent,
  colorMap,
  filter,
  onSelectFilter,
}: {
  categories: Category[];
  transactions: Transaction[];
  totalCount: number;
  uncategorizedCount: number;
  uncategorizedSpent: number;
  colorMap: Map<string, CategorySwatch>;
  filter: CategoryFilter;
  onSelectFilter: (filter: CategoryFilter) => void;
}) {
  const [query, setQuery] = useState("");
  const tree = buildCategoryTree(categories);
  const spentByCategory = new Map<string, number>();
  const countByCategory = new Map<string, number>();

  for (const transaction of transactions) {
    if (!transaction.category_id) continue;
    countByCategory.set(
      transaction.category_id,
      (countByCategory.get(transaction.category_id) ?? 0) + 1,
    );
    if (transaction.amount < 0) {
      spentByCategory.set(
        transaction.category_id,
        (spentByCategory.get(transaction.category_id) ?? 0) - transaction.amount,
      );
    }
  }

  const parentRows = tree.map(({ parent, children }) => {
    const categoryIds = [parent.id, ...children.map((child) => child.id)];
    return {
      parent,
      children,
      categoryIds,
      spent: categoryIds.reduce((sum, id) => sum + (spentByCategory.get(id) ?? 0), 0),
      count: categoryIds.reduce((sum, id) => sum + (countByCategory.get(id) ?? 0), 0),
    };
  });
  const max = Math.max(1, ...parentRows.map((row) => row.spent));
  const normalizedQuery = query.trim().toLowerCase();
  const visibleParentRows = normalizedQuery
    ? parentRows.filter(
        ({ parent, children }) =>
          parent.name.toLowerCase().includes(normalizedQuery) ||
          children.some((child) => child.name.toLowerCase().includes(normalizedQuery)),
      )
    : parentRows;

  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Categories
        </h2>
        <span className="hidden text-[10px] text-muted-foreground sm:inline">
          Drag transactions here
        </span>
      </div>

      <div className="relative my-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a category…"
          aria-label="Find a category"
          className="h-8 pl-8 text-xs"
        />
      </div>

      <SidebarRow
        icon={Layers}
        swatch={NEUTRAL_SWATCH}
        name="All transactions"
        active={filter.kind === "all"}
        trailing={<span className="text-sm text-muted-foreground tabular-nums">{totalCount}</span>}
        onClick={() => onSelectFilter({ kind: "all" })}
      />

      {visibleParentRows.map(({ parent, children, categoryIds, spent, count }) => {
        const swatch = colorMap.get(parent.id) ?? NEUTRAL_SWATCH;
        const active = filter.kind === "category" && filter.sliceId === parent.id;
        const childIsActive =
          filter.kind === "category" && children.some((child) => child.id === filter.sliceId);
        const showChildren = active || childIsActive || normalizedQuery.length > 0;
        const visibleChildren = normalizedQuery
          ? children.filter(
              (child) =>
                parent.name.toLowerCase().includes(normalizedQuery) ||
                child.name.toLowerCase().includes(normalizedQuery),
            )
          : children;

        return (
          <div key={parent.id} className="flex flex-col gap-1">
            <DroppableSidebarRow
              categoryId={parent.id}
              icon={categoryIcon(parent.icon, parent.name)}
              swatch={swatch}
              name={parent.name}
              active={active}
              trailing={<CategoryAmount spent={spent} count={count} />}
              meter={spent > 0 ? { fraction: spent / max } : undefined}
              suffix={
                children.length > 0 ? (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    {children.length}
                    <ChevronDown
                      className={cn("size-3 transition-transform", showChildren && "rotate-180")}
                    />
                  </span>
                ) : undefined
              }
              onClick={() =>
                onSelectFilter(
                  active
                    ? { kind: "all" }
                    : {
                        kind: "category",
                        sliceId: parent.id,
                        categoryIds,
                        name: parent.name,
                      },
                )
              }
            />

            {showChildren && visibleChildren.map((child) => {
              const childActive = filter.kind === "category" && filter.sliceId === child.id;
              return (
                <DroppableSidebarRow
                  key={child.id}
                  categoryId={child.id}
                  icon={categoryIcon(child.icon, child.name)}
                  swatch={swatch}
                  name={child.name}
                  active={childActive}
                  indent
                  trailing={
                    <CategoryAmount
                      spent={spentByCategory.get(child.id) ?? 0}
                      count={countByCategory.get(child.id) ?? 0}
                    />
                  }
                  onClick={() =>
                    onSelectFilter(
                      childActive
                        ? { kind: "all" }
                        : {
                            kind: "category",
                            sliceId: child.id,
                            categoryIds: [child.id],
                            name: child.name,
                          },
                    )
                  }
                />
              );
            })}
          </div>
        );
      })}

      <DroppableSidebarRow
        categoryId={null}
        icon={CircleDashed}
        swatch={UNCATEGORIZED_SWATCH}
        name="Uncategorized"
        active={filter.kind === "uncategorized"}
        trailing={<CategoryAmount spent={uncategorizedSpent} count={uncategorizedCount} />}
        onClick={() =>
          onSelectFilter(
            filter.kind === "uncategorized" ? { kind: "all" } : { kind: "uncategorized" },
          )
        }
      />
    </section>
  );
}

function CategoryAmount({ spent, count }: { spent: number; count: number }) {
  if (spent === 0 && count === 0) return null;

  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-semibold tabular-nums">{formatSpend(spent)}</span>
      <span className="text-[10px] tabular-nums text-muted-foreground">{count}</span>
    </span>
  );
}

function DroppableSidebarRow({
  categoryId,
  ...props
}: Omit<ComponentProps<typeof SidebarRow>, "rowRef" | "isOver"> & {
  categoryId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `overview-category-${categoryId ?? "uncategorized"}`,
    data: { categoryId },
  });

  return <SidebarRow {...props} rowRef={setNodeRef} isOver={isOver} />;
}

function SidebarRow({
  icon: Icon,
  swatch,
  name,
  active,
  trailing,
  suffix,
  meter,
  indent = false,
  rowRef,
  isOver = false,
  onClick,
}: {
  icon: LucideIcon;
  swatch: CategorySwatch;
  name: string;
  active: boolean;
  trailing: ReactNode;
  suffix?: ReactNode;
  meter?: { fraction: number };
  indent?: boolean;
  rowRef?: (node: HTMLElement | null) => void;
  isOver?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      ref={rowRef}
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-2.5 py-2 text-left text-xs transition-all",
        indent && "ml-6 py-1.5",
        isOver
          ? cn("scale-[1.02] border-transparent bg-primary/10 ring-2", swatch.ring)
          : active
            ? cn("border-transparent ring-2", swatch.ring)
            : "border-transparent hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full",
          indent ? "size-7" : "size-9",
          swatch.badge,
        )}
      >
        <Icon className={indent ? "size-3.5" : "size-4.5"} strokeWidth={2} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate font-semibold" title={name}>
            {isOver ? `Move to ${name}` : name}
          </span>
          {!isOver && <span className="shrink-0">{trailing}</span>}
          {!isOver && suffix && <span className="shrink-0">{suffix}</span>}
        </span>

        {meter && (
          <span className="h-1.5 min-w-0 overflow-hidden rounded-full bg-chart-track">
            <span
              className={cn("block h-full rounded-full", swatch.bar)}
              style={{ width: `${Math.max(meter.fraction * 100, 2)}%` }}
            />
          </span>
        )}
      </span>
    </button>
  );
}
