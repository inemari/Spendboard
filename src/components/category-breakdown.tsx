import { formatSpend } from "@/lib/format";
import type { CategorySlice } from "@/lib/overview";

/**
 * Ranked "where the money went" bars.
 *
 * Every bar wears the same slot-1 hue on purpose. These categories are nominal —
 * reordering them changes nothing — so colouring them by value would re-encode
 * what the bar length already says and spend the identity channel for nothing.
 * One series also means no legend box is needed; the heading names what's plotted.
 */
export function CategoryBreakdown({ slices }: { slices: CategorySlice[] }) {
  if (slices.length === 0) return null;

  // Bars are scaled against the biggest slice, so the ranking stays readable even
  // when one category dominates. The share label carries the true proportion.
  const max = Math.max(...slices.map((s) => s.spent));

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
      <h2 className="font-heading text-base font-bold">Where it went</h2>

      <ul className="flex flex-col gap-3.5">
        {slices.map((slice) => (
          <li key={slice.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-medium">{slice.name}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                <span className="text-sm font-semibold tabular-nums">
                  {formatSpend(slice.spent)}
                </span>
                <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                  {Math.round(slice.share * 100)}%
                </span>
              </span>
            </div>

            {/* Thin mark, rounded data-end, square at the baseline. */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-chart-track">
              <div
                className="h-full rounded-r-full bg-chart-1"
                style={{ width: `${Math.max((slice.spent / max) * 100, 1.5)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
