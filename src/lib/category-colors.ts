import { buildCategoryTree } from "@/lib/category-tree";
import type { Category } from "@/lib/types";

/**
 * Per-category accent colors, shared by the overview's category filter
 * sidebar and the board's kanban columns.
 *
 * This is identity chrome, not a data-magnitude chart: every row/column
 * always shows the category's name and amount as text, so a color never
 * carries meaning alone (a single-hue bar would be the right call if this
 * only encoded "how much" — it doesn't, it's also a clickable filter target,
 * so each category gets its own color to stay recognizable). Assigned by a
 * category's position among its *siblings* (`buildCategoryColorMap`, sort
 * order), not by spend rank — a category's color must stay the same in the
 * sidebar and on the board, and must not shift month to month just because
 * its rank did. Same principle as the Rules page's column-header gradients
 * (`rules-manager-panel.tsx`'s CATEGORY_GRADIENTS).
 */
export type CategorySwatch = {
  /** Solid fill for the progress bar and the identity dot. */
  bar: string;
  /** Colored text for the share percentage. */
  text: string;
  /** Colored ring for the row when it's the active filter. */
  ring: string;
  /** Light pill background + text, for the "Transactions" heading's filter chip. */
  soft: string;
  /** Soft, pastel multi-stop gradient for the categorize screen's
   *  gradient-filled category blobs at rest — every other consumer only
   *  ever uses the flat `bar`. */
  gradient: string;
  /** A richer version of the same hue family for the categorize screen's
   *  selected/expanded blob — same identity color, just more saturated, so
   *  "selected" reads as more prominent without breaking from the
   *  category's own color (color identity must stay stable everywhere else
   *  the swatch is used). */
  gradientSelected: string;
};

const SWATCHES: CategorySwatch[] = [
  { bar: "bg-rose-500", text: "text-rose-600", ring: "ring-rose-400", soft: "bg-rose-100 text-rose-700", gradient: "from-pink-200 via-fuchsia-200 to-purple-300", gradientSelected: "from-pink-300 via-fuchsia-300 to-purple-400" },
  { bar: "bg-sky-500", text: "text-sky-600", ring: "ring-sky-400", soft: "bg-sky-100 text-sky-700", gradient: "from-cyan-200 via-sky-200 to-indigo-200", gradientSelected: "from-cyan-300 via-sky-300 to-indigo-300" },
  { bar: "bg-amber-500", text: "text-amber-600", ring: "ring-amber-400", soft: "bg-amber-100 text-amber-700", gradient: "from-yellow-200 to-orange-200", gradientSelected: "from-yellow-300 to-orange-300" },
  { bar: "bg-emerald-500", text: "text-emerald-600", ring: "ring-emerald-400", soft: "bg-emerald-100 text-emerald-700", gradient: "from-lime-200 to-emerald-200", gradientSelected: "from-lime-300 to-emerald-300" },
  { bar: "bg-violet-500", text: "text-violet-600", ring: "ring-violet-400", soft: "bg-violet-100 text-violet-700", gradient: "from-violet-200 via-purple-200 to-pink-200", gradientSelected: "from-violet-300 via-purple-300 to-pink-300" },
  { bar: "bg-orange-500", text: "text-orange-600", ring: "ring-orange-400", soft: "bg-orange-100 text-orange-700", gradient: "from-orange-200 to-amber-200", gradientSelected: "from-orange-300 to-amber-300" },
  { bar: "bg-teal-500", text: "text-teal-600", ring: "ring-teal-400", soft: "bg-teal-100 text-teal-700", gradient: "from-emerald-200 to-cyan-200", gradientSelected: "from-emerald-300 to-cyan-300" },
  { bar: "bg-fuchsia-500", text: "text-fuchsia-600", ring: "ring-fuchsia-400", soft: "bg-fuchsia-100 text-fuchsia-700", gradient: "from-fuchsia-200 via-pink-200 to-rose-200", gradientSelected: "from-fuchsia-300 via-pink-300 to-rose-300" },
];

export function categorySwatch(index: number): CategorySwatch {
  return SWATCHES[index % SWATCHES.length];
}

/** For aggregates that don't correspond to one real category — the folded
 *  "Other" tail — since a rotating hue would misrepresent them as a single
 *  entity. Mirrors how "Need review" wears muted ink rather than a fake hue. */
export const NEUTRAL_SWATCH: CategorySwatch = {
  bar: "bg-muted-foreground/40",
  text: "text-muted-foreground",
  ring: "ring-muted-foreground/30",
  soft: "bg-muted text-muted-foreground",
  gradient: "from-muted-foreground/30 to-muted-foreground/20",
  gradientSelected: "from-muted-foreground/45 to-muted-foreground/30",
};

/** Uncategorized isn't a category — it keeps the app's brand pink everywhere
 *  else, so it does here too rather than taking a slot in the rotation. */
export const UNCATEGORIZED_SWATCH: CategorySwatch = {
  bar: "bg-primary",
  text: "text-primary",
  ring: "ring-primary",
  soft: "bg-primary/10 text-primary",
  gradient: "from-primary/30 to-secondary/30",
  gradientSelected: "from-primary/50 to-secondary/50",
};

/**
 * One stable color per top-level category, keyed by its position among
 * top-level categories (sort order) — not spend rank, so a category's color
 * doesn't shift between the sidebar and the board or from month to month.
 * Subcategories inherit their parent's color, so scanning by hue still works
 * for the nested rows on a board column.
 */
export function buildCategoryColorMap(categories: Category[]): Map<string, CategorySwatch> {
  const map = new Map<string, CategorySwatch>();
  buildCategoryTree(categories).forEach(({ parent, children }, index) => {
    const swatch = categorySwatch(index);
    map.set(parent.id, swatch);
    for (const child of children) map.set(child.id, swatch);
  });
  return map;
}
