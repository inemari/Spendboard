export type ViewMode = "day" | "week" | "month" | "range";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function todayISO(): string {
  return toISODate(new Date());
}

/** December→January rollover in both directions, handled by Date normalisation. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function startOfMonthISO(year: number, month: number): string {
  return toISODate(new Date(year, month - 1, 1));
}

function endOfMonthISO(year: number, month: number): string {
  return toISODate(new Date(year, month, 0));
}

/** Monday-start week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const isoDay = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setDate(d.getDate() - isoDay);
  return d;
}

export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
}

export type ResolvedRange = { from: string; to: string; anchor: string };

/**
 * Turns a view mode + its URL params into a concrete inclusive date range.
 * `anchor` is the single date used for stepping (see shiftByView) — for
 * `month` it's the 1st of the month, for `range` it's `from`.
 */
export function resolveRange(
  view: ViewMode,
  params: { year: number; month: number; date?: string; from?: string; to?: string },
): ResolvedRange {
  switch (view) {
    case "day": {
      const anchor = params.date ?? todayISO();
      return { from: anchor, to: anchor, anchor };
    }
    case "week": {
      const anchor = params.date ?? todayISO();
      const anchorDate = parseISODate(anchor);
      return { from: toISODate(startOfWeek(anchorDate)), to: toISODate(endOfWeek(anchorDate)), anchor };
    }
    case "range": {
      const from = params.from ?? startOfMonthISO(params.year, params.month);
      const to = params.to ?? endOfMonthISO(params.year, params.month);
      return { from, to, anchor: from };
    }
    case "month":
    default: {
      const anchor = startOfMonthISO(params.year, params.month);
      return { from: anchor, to: endOfMonthISO(params.year, params.month), anchor };
    }
  }
}

/**
 * Steps the anchor by one unit of the given view (day, week, or month).
 * Not defined for `range` — an arbitrary span has no natural "next".
 */
export function shiftByView(
  view: "day" | "week" | "month",
  params: { year: number; month: number; date?: string },
  delta: number,
): { date?: string; year: number; month: number } {
  if (view === "month") {
    const next = shiftMonth(params.year, params.month, delta);
    return { year: next.year, month: next.month };
  }

  const anchor = params.date ?? todayISO();
  const anchorDate = parseISODate(anchor);
  const days = view === "week" ? 7 * delta : delta;
  anchorDate.setDate(anchorDate.getDate() + days);
  return { date: toISODate(anchorDate), year: anchorDate.getFullYear(), month: anchorDate.getMonth() + 1 };
}

const dayLabelFormatter = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short" });
const weekLabelFormatter = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric" });
const monthLabelFormatter = new Intl.DateTimeFormat("nb-NO", { month: "long", year: "numeric" });

export function formatRangeLabel(view: ViewMode, range: ResolvedRange): string {
  if (view === "day") {
    return dayLabelFormatter.format(parseISODate(range.from));
  }
  if (view === "week") {
    return `${dayLabelFormatter.format(parseISODate(range.from))} – ${weekLabelFormatter.format(parseISODate(range.to))}`;
  }
  if (view === "month") {
    return monthLabelFormatter.format(parseISODate(range.from));
  }
  return `${weekLabelFormatter.format(parseISODate(range.from))} – ${weekLabelFormatter.format(parseISODate(range.to))}`;
}
