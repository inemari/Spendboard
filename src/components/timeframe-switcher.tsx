"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { formatRangeLabel, resolveRange, shiftByView, type ViewMode } from "@/lib/date-range";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TABS: { mode: ViewMode; label: string }[] = [
  { mode: "day", label: "Day" },
  { mode: "week", label: "Week" },
  { mode: "month", label: "Month" },
  { mode: "range", label: "Custom" },
];

export function TimeframeSwitcher({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = (searchParams.get("view") as ViewMode | null) ?? "month";
  const date = searchParams.get("date") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const range = resolveRange(view, { year, month, date, from, to });
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo, setCustomTo] = useState(range.to);

  // Day/week/range navigation stays on this same page instance (query params
  // only) — routing to a different [year]/[month] path, even one implied by
  // a shifted date, is a genuinely different page in Next.js and remounts
  // the whole subtree, wiping the board's Overview/Board toggle state. Only
  // the month view is meant to actually change which month's page you're on.
  function navigate(params: { view: ViewMode; date?: string; year?: number; month?: number; from?: string; to?: string }) {
    const targetYear = params.view === "month" ? params.year ?? year : year;
    const targetMonth = params.view === "month" ? params.month ?? month : month;
    const query = new URLSearchParams();
    if (params.view !== "month") query.set("view", params.view);
    if (params.view !== "month" && params.date) query.set("date", params.date);
    if (params.view === "range" && params.from) query.set("from", params.from);
    if (params.view === "range" && params.to) query.set("to", params.to);
    const qs = query.toString();
    router.push(`/${targetYear}/${targetMonth}${qs ? `?${qs}` : ""}`);
  }

  function selectTab(mode: ViewMode) {
    if (mode === "range") {
      navigate({ view: "range", from: range.from, to: range.to });
      return;
    }
    navigate({ view: mode, date: range.anchor, year, month });
  }

  function step(delta: number) {
    if (view === "range") return;
    const next = shiftByView(view, { year, month, date }, delta);
    navigate({ view, date: next.date, year: next.year, month: next.month });
  }

  function applyCustomRange() {
    navigate({ view: "range", from: customFrom, to: customTo });
  }

  const arrow =
    "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2">
      <div className="flex items-center gap-1 rounded-md bg-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            onClick={() => selectTab(tab.mode)}
            className={cn(
              "rounded-sm px-2.5 py-1 text-sm font-medium transition-colors",
              view === tab.mode
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view !== "range" && (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => step(-1)} aria-label="Previous" className={arrow}>
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-32 text-center text-sm font-medium capitalize">
            {formatRangeLabel(view, range)}
          </span>
          <button type="button" onClick={() => step(1)} aria-label="Next" className={arrow}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}

      {view === "range" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-8 w-36"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-8 w-36"
          />
          <button
            type="button"
            onClick={applyCustomRange}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
