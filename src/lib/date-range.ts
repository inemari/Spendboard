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

/** First of the month containing `date`. Also the canonical `?date=` value for month view. */
export function startOfMonthISO(date: Date): string {
  return toISODate(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonthISO(date: Date): string {
  return toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

/** `?date=` for the month a given ISO date falls in — e.g. linking back to a transaction's month. */
export function monthAnchorFor(isoDate: string): string {
  return startOfMonthISO(parseISODate(isoDate));
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
 *
 * Everything hangs off one optional `date` anchor — the only timeframe state
 * in the URL, and the reason no route needs a `[year]/[month]` segment. Omit
 * it and every view falls back to today (so a bare `/` is the current month).
 * `anchor` is the date used for stepping (see shiftByView): for `month` it's
 * normalised to the 1st, for `range` it's `from`.
 */
export function resolveRange(
  view: ViewMode,
  params: { date?: string; from?: string; to?: string } = {},
): ResolvedRange {
  const anchorDate = parseISODate(params.date ?? todayISO());

  switch (view) {
    case "day": {
      const anchor = toISODate(anchorDate);
      return { from: anchor, to: anchor, anchor };
    }
    case "week": {
      return {
        from: toISODate(startOfWeek(anchorDate)),
        to: toISODate(endOfWeek(anchorDate)),
        anchor: toISODate(anchorDate),
      };
    }
    case "range": {
      const from = params.from ?? startOfMonthISO(anchorDate);
      const to = params.to ?? endOfMonthISO(anchorDate);
      return { from, to, anchor: from };
    }
    case "month":
    default: {
      const anchor = startOfMonthISO(anchorDate);
      return { from: anchor, to: endOfMonthISO(anchorDate), anchor };
    }
  }
}

/**
 * Steps the anchor by one unit of the given view (day, week, or month).
 * Not defined for `range` — an arbitrary span has no natural "next".
 */
export function shiftByView(
  view: "day" | "week" | "month",
  params: { date?: string },
  delta: number,
): { date: string } {
  const anchorDate = parseISODate(params.date ?? todayISO());

  if (view === "month") {
    const next = shiftMonth(anchorDate.getFullYear(), anchorDate.getMonth() + 1, delta);
    return { date: `${next.year}-${pad(next.month)}-01` };
  }

  anchorDate.setDate(anchorDate.getDate() + (view === "week" ? 7 * delta : delta));
  return { date: toISODate(anchorDate) };
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
