"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatSpend } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Overview } from "@/lib/overview";
import type { TxType } from "@/lib/types";

/**
 * Part-to-whole meter for the common/personal split.
 *
 * Two categorical slots only — "need review" is an undecided *state*, not a peer
 * series, so it takes muted ink rather than a third hue. Segments are separated
 * by a 2px surface gap (not a border), and each carries a labelled swatch below,
 * which is also the secondary encoding the dark palette's 7.7 CVD ΔE requires.
 */
function SplitMeter({
  segments,
  total,
  onSelectType,
}: {
  segments: { type: TxType; label: string; value: number; className: string; swatch: string }[];
  total: number;
  onSelectType: (type: TxType) => void;
}) {
  const present = segments.filter((s) => s.value > 0);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-chart-track"
        role="img"
        aria-label={present
          .map((s) => `${s.label} ${formatSpend(s.value)}`)
          .join(", ")}
      >
        {present.map((segment) => (
          <div
            key={segment.type}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", segment.className)}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
      </div>

      {/* Legend doubles as the direct labels — every value is readable without hover. */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((segment) => (
          <button
            key={segment.type}
            type="button"
            onClick={() => onSelectType(segment.type)}
            className="group flex items-center gap-2 text-left"
          >
            <span className={cn("size-2.5 shrink-0 rounded-full", segment.swatch)} />
            <span className="text-xs text-muted-foreground group-hover:text-foreground">
              {segment.label}
            </span>
            <span className="text-xs font-semibold tabular-nums">{formatSpend(segment.value)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function OverviewSummary({
  overview,
  categorizeHref,
  onSelectType,
}: {
  overview: Overview;
  categorizeHref: string;
  onSelectType: (type: TxType) => void;
}) {
  const { spent, income, commonSpent, personalSpent, needReviewSpent } = overview;
  const { uncategorizedCount, needReviewCount } = overview;

  const segments = [
    {
      type: "common" as const,
      label: "Common",
      value: commonSpent,
      className: "bg-chart-1",
      swatch: "bg-chart-1",
    },
    {
      type: "personal" as const,
      label: "Personal",
      value: personalSpent,
      className: "bg-chart-2",
      swatch: "bg-chart-2",
    },
    {
      type: "need_review" as const,
      label: "Need review",
      value: needReviewSpent,
      className: "bg-muted-foreground/40",
      swatch: "bg-muted-foreground/40",
    },
  ];

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Spent this month</p>
          {/* Hero figure: proportional figures, not tabular — tabular-nums makes a
              large standalone number look loose. */}
          <p className="font-heading text-4xl font-bold sm:text-5xl">{formatSpend(spent)}</p>
        </div>

        {income > 0 && (
          <div className="text-right">
            <p className="flex items-center justify-end gap-1.5 text-sm text-muted-foreground">
              <TrendingUp className="size-3.5" />
              Income
            </p>
            <p className="text-xl font-semibold tabular-nums">{formatSpend(income)}</p>
          </div>
        )}
      </div>

      {spent > 0 && <SplitMeter segments={segments} total={spent} onSelectType={onSelectType} />}

      {(uncategorizedCount > 0 || needReviewCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/60 px-4 py-3">
          <p className="flex items-center gap-2 text-sm">
            <AlertCircle className="size-4 shrink-0 text-primary" />
            <span>
              {uncategorizedCount > 0 && (
                <strong className="font-semibold">{uncategorizedCount} uncategorized</strong>
              )}
              {uncategorizedCount > 0 && needReviewCount > 0 && " · "}
              {needReviewCount > 0 && <>{needReviewCount} need review</>}
            </span>
          </p>

          {uncategorizedCount > 0 && (
            <Button size="sm" nativeButton={false} render={<Link href={categorizeHref} />}>
              Sort them
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
