/**
 * Per-category accent colors for the overview's category filter list.
 *
 * This is identity chrome, not a data-magnitude chart: every row always shows
 * the category's name and amount as text, so a color never carries meaning
 * alone (a single-hue bar would be the right call if this only encoded "how
 * much" — it doesn't, it's also a clickable filter, so each category gets its
 * own color to stay recognizable as a filter target). Assigned by position
 * in the ranked breakdown, same principle as the Rules page's column-header
 * gradients (`rules-manager-panel.tsx`'s CATEGORY_GRADIENTS) — a category
 * keeps its color as siblings come and go, as long as the ranking is stable.
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
};

const SWATCHES: CategorySwatch[] = [
  { bar: "bg-rose-500", text: "text-rose-600", ring: "ring-rose-400", soft: "bg-rose-100 text-rose-700" },
  { bar: "bg-sky-500", text: "text-sky-600", ring: "ring-sky-400", soft: "bg-sky-100 text-sky-700" },
  { bar: "bg-amber-500", text: "text-amber-600", ring: "ring-amber-400", soft: "bg-amber-100 text-amber-700" },
  { bar: "bg-emerald-500", text: "text-emerald-600", ring: "ring-emerald-400", soft: "bg-emerald-100 text-emerald-700" },
  { bar: "bg-violet-500", text: "text-violet-600", ring: "ring-violet-400", soft: "bg-violet-100 text-violet-700" },
  { bar: "bg-orange-500", text: "text-orange-600", ring: "ring-orange-400", soft: "bg-orange-100 text-orange-700" },
  { bar: "bg-teal-500", text: "text-teal-600", ring: "ring-teal-400", soft: "bg-teal-100 text-teal-700" },
  { bar: "bg-fuchsia-500", text: "text-fuchsia-600", ring: "ring-fuchsia-400", soft: "bg-fuchsia-100 text-fuchsia-700" },
];

export function categorySwatch(index: number): CategorySwatch {
  return SWATCHES[index % SWATCHES.length];
}
