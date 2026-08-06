import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

function shift(year: number, month: number, delta: number): { year: number; month: number } {
  // Date normalises the December→January rollover in both directions for us.
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Prev/next month stepping. Until now the only way to reach another month was to
 * hand-edit the URL, so this is the page's main navigation affordance.
 */
export function MonthNav({ year, month }: { year: number; month: number }) {
  const previous = shift(year, month, -1);
  const next = shift(year, month, 1);

  const arrow =
    "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/${previous.year}/${previous.month}`}
        aria-label={`Go to ${formatMonthLabel(previous.year, previous.month)}`}
        className={arrow}
      >
        <ChevronLeft className="size-4" />
      </Link>

      <h1 className="min-w-40 text-center font-heading text-lg font-bold capitalize sm:min-w-48 sm:text-xl">
        {formatMonthLabel(year, month)}
      </h1>

      <Link
        href={`/${next.year}/${next.month}`}
        aria-label={`Go to ${formatMonthLabel(next.year, next.month)}`}
        className={cn(arrow)}
      >
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}
