import type { LucideIcon } from "lucide-react";
import { formatSpend } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Shared "playful pop" stat primitives for the settlement screen — a big
 * bold headline figure (mirrors `OverviewSummary`'s "Spent" hero,
 * src/components/overview-summary.tsx) and a Personal/Common breakdown
 * that reuses the exact same chart-1 (common, pink)/chart-2 (personal, sky
 * blue) color assignment as the overview's own split meter, so "which color
 * means which type" never has to be relearned between screens. Used by both
 * the open-invoice summary step and the completed-settlement snapshot so
 * neither one invents its own version of this.
 */

export function HeroFigure({
  icon: Icon,
  label,
  value,
  size = "lg",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  /** "lg" is the primary-focus figure (matches OverviewSummary's "Spent"
   *  hero); "sm" is for the same figure shown with deliberately less
   *  visual weight, e.g. a partner's section next to the user's own. */
  size?: "lg" | "sm";
}) {
  return (
    <div className="flex items-baseline gap-2">
      <p
        className={cn(
          "flex items-center gap-1.5 text-muted-foreground",
          size === "lg" ? "text-sm" : "text-xs",
        )}
      >
        <Icon className={size === "lg" ? "size-3.5" : "size-3"} />
        {label}
      </p>
      <p className={cn("font-heading font-bold", size === "lg" ? "text-3xl" : "text-xl")}>{value}</p>
    </div>
  );
}

/** One equal-weight supporting figure in a row of them (Personal / Common
 *  share / Contribution) — deliberately plainer than HeroFigure, so the
 *  hierarchy stays "one hero, three supporting facts" rather than four
 *  numbers competing for the same attention. */
export function MiniStat({
  label,
  value,
  dotClassName,
}: {
  label: string;
  value: string;
  /** Optional colored dot (e.g. chart-1/chart-2) tying this figure back to
   *  the same Common/Personal color coding used elsewhere on the screen. */
  dotClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {dotClassName && <span className={cn("size-1.5 shrink-0 rounded-full", dotClassName)} />}
        {label}
      </p>
      <p className="text-base font-bold tabular-nums">{value}</p>
    </div>
  );
}

/** A small colored-dot pill for one type's amount — "Common"/"Personal"
 *  only, the same two categorical slots as the overview meter. */
export function TypeBadge({
  type,
  amount,
}: {
  type: "common" | "personal";
  amount: number;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold whitespace-nowrap">
      <span
        className={cn("size-2 shrink-0 rounded-full", type === "common" ? "bg-chart-1" : "bg-chart-2")}
      />
      {type === "common" ? "Common" : "Personal"}
      <span className="tabular-nums">{formatSpend(amount)}</span>
    </span>
  );
}

/** Two-segment part-to-whole bar for one person's Personal/Common split —
 *  same visual construction as OverviewSummary's SplitMeter (2px surface
 *  gap between segments, rounded pill track, labelled legend beneath so
 *  every value reads without hovering), just without the need-review
 *  segment, which doesn't apply once a transaction has settled into one
 *  type or the other. */
export function PersonalCommonBar({
  personal,
  common,
}: {
  personal: number;
  common: number;
}) {
  const total = personal + common;
  if (total <= 0) return null;

  const segments = [
    { key: "common", value: common, className: "bg-chart-1" },
    { key: "personal", value: personal, className: "bg-chart-2" },
  ].filter((s) => s.value > 0);

  return (
    <div
      className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-chart-track"
      role="img"
      aria-label={`Common ${formatSpend(common)}, Personal ${formatSpend(personal)}`}
    >
      {segments.map((s) => (
        <div
          key={s.key}
          className={cn("h-full first:rounded-l-full last:rounded-r-full", s.className)}
          style={{ width: `${(s.value / total) * 100}%` }}
        />
      ))}
    </div>
  );
}
