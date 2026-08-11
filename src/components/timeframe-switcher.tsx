"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { formatRangeLabel, resolveRange, shiftByView, type ViewMode } from "@/lib/date-range";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Custom is not in here — it's the popover trigger, not a plain tab. */
const TABS: { mode: "day" | "week" | "month"; label: string }[] = [
  { mode: "day", label: "Day" },
  { mode: "week", label: "Week" },
  { mode: "month", label: "Month" },
];

export function TimeframeSwitcher({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = (searchParams.get("view") as ViewMode | null) ?? "month";
  const date = searchParams.get("date") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const range = resolveRange(view, { year, month, date, from, to });
  const [customOpen, setCustomOpen] = useState(false);
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

  function selectTab(mode: "day" | "week" | "month") {
    navigate({ view: mode, date: range.anchor, year, month });
  }

  /** Seed the fields from whatever range is showing each time the menu opens. */
  function toggleCustom(open: boolean) {
    if (open) {
      setCustomFrom(range.from);
      setCustomTo(range.to);
    }
    setCustomOpen(open);
  }

  function step(delta: number) {
    if (view === "range") return;
    const next = shiftByView(view, { year, month, date }, delta);
    navigate({ view, date: next.date, year: next.year, month: next.month });
  }

  function applyCustomRange() {
    navigate({ view: "range", from: customFrom, to: customTo });
    setCustomOpen(false);
  }

  // Candy system (DESIGN.md): pills, bouncy scale on hover/press, and the
  // active pill wearing brand pink with its own tinted shadow.
  const arrow =
    "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 ease-out hover:scale-110 hover:bg-background hover:text-foreground active:scale-95";
  const tab =
    "rounded-full px-3 py-1 text-sm font-medium transition-all duration-200 ease-out hover:scale-[1.03] active:scale-[0.97]";
  const tabActive =
    "bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(224,64,160,0.25)]";
  const tabIdle = "text-muted-foreground hover:bg-background/70 hover:text-foreground";

  return (
    <>
      <div className="flex items-center gap-1 rounded-full bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.mode}
            type="button"
            onClick={() => selectTab(t.mode)}
            className={cn(tab, view === t.mode ? tabActive : tabIdle)}
          >
            {t.label}
          </button>
        ))}

        <Popover open={customOpen} onOpenChange={toggleCustom}>
          <PopoverTrigger
            className={cn(
              tab,
              "inline-flex items-center gap-1.5",
              view === "range" || customOpen ? tabActive : tabIdle,
            )}
          >
            <CalendarRange className="size-3.5" />
            Custom
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-3 rounded-2xl">
            <p className="font-heading text-sm font-bold">Pick your own span ✨</p>
            <div className="space-y-1">
              <label htmlFor="custom-range-from" className="text-xs font-medium text-secondary">
                From
              </label>
              <Input
                id="custom-range-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-8 w-full"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="custom-range-to" className="text-xs font-medium text-secondary">
                To
              </label>
              <Input
                id="custom-range-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-8 w-full"
              />
            </div>
            <Button
              onClick={applyCustomRange}
              disabled={!customFrom || !customTo || customFrom > customTo}
              className="w-full"
            >
              Show me
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {view === "range" ? (
        <Badge variant="secondary" className="h-7 px-3 text-sm">
          {formatRangeLabel(view, range)}
        </Badge>
      ) : (
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
    </>
  );
}
