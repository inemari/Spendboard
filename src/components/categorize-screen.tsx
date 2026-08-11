"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Flame,
  GripVertical,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Trophy,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import { createCategory } from "@/lib/create-category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CategoryDropZone } from "@/components/category-drop-zone";
import { CategoryIconPicker } from "@/components/category-icon-picker";
import { ConfettiBurst } from "@/components/confetti-burst";
import { buildCategoryTree } from "@/lib/category-tree";
import {
  buildCategoryColorMap,
  NEUTRAL_SWATCH,
  type CategorySwatch,
} from "@/lib/category-colors";
import { formatAmount, formatDate, formatTxType } from "@/lib/format";
import {
  nodeSizeForIndex,
  scatterJitter,
  subcategorySizeRatio,
} from "@/lib/organic-shapes";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

const NO_PARENT_VALUE = "__none__";

// Every top-level node gets its own pseudo-random size (nodeSizeForIndex);
// subcategories are a fixed fraction of their own parent, so the geometry
// below is computed per cluster rather than from shared constants.
// Satellites fan out to the right of the (left-anchored) parent across
// ±FAN_SPREAD_RAD, rather than surrounding it on all sides.
const FAN_SPREAD_RAD = (45 * Math.PI) / 180;
const SATELLITE_GAP = 6;

// The ellipse the category nodes orbit on, as a percentage of the
// constellation container. Wider than tall because the viewport is: a true
// circle large enough to space the nodes out horizontally would run off the
// bottom of a laptop screen.
//
// Note this sets how much *room* the nodes have, not how far apart they
// look: nodes grow to fill that room and stop at NODE_MIN_GAP from each
// other, so a wider ring yields bigger nodes rather than a sparser one.
// Tightening the ring here would shrink the categories, not close the gaps.
// INNER_REACH staggers alternating nodes so neighbours interleave.
const RING_RX_PCT = 36;
const RING_RY_PCT = 33;
const RING_INNER_REACH = 0.88;

// Concentric rings drawn around the selected (expanded) parent — thin,
// translucent, progressively larger than the parent itself.
const SELECTED_RING_GAPS = [10, 22, 36];

// Breathing room kept between the outermost node edge and the container.
const RING_EDGE_MARGIN = 10;
// Clear air between two neighbouring nodes, and between a node and the card.
// These are what the nodes grow *until* — they set the visible spacing.
const NODE_MIN_GAP = 22;
const CARD_MIN_GAP = 28;
// The card's rendered height, used only to keep nodes off it. Cheaper and
// steadier than measuring it — it's a fixed-layout card, and a stale
// measurement mid-transition would make nodes twitch.
const CARD_HEIGHT = 130;
// Below this the labels stop being readable, so the screen gives up on
// shrinking rather than degrading into unreadable dots. There is no mobile
// layout for the constellation; this only guards small desktop windows.
const MIN_NODE_SCALE = 0.55;
// Nodes grow to fill whatever room the ring leaves them, up to this. The cap
// only stops a sparse constellation (two or three categories) from inflating
// into a few enormous circles.
const MAX_NODE_SCALE = 1.9;

/** Tracks a element's rendered size. The constellation positions its ring in
 *  percentages, but node sizes are in pixels — so without knowing the actual
 *  box we can't tell whether those pixels still fit. */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // setState lives in the observer callback, not the effect body: this is
    // syncing from an external system, which is the pattern effects are for.
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

type RingSlot = {
  /** Outward direction, and where the node sits as a % offset from centre. */
  angle: number;
  xPct: number;
  yPct: number;
  /** Resolved centre in container pixels (0 until the container is measured). */
  cx: number;
  cy: number;
  baseSize: number;
  jitter: { x: number; y: number; rotationDeg: number };
};

/**
 * Where every top-level node sits on the ring. Positions don't depend on
 * the node scale — the ring is a percentage of the container — which is what
 * lets `fitNodeScale` solve for a scale from these positions and then hand
 * the same slots to the render.
 */
function ringLayout(
  width: number,
  height: number,
  count: number,
): RingSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    // Alternating radius staggers neighbours so they interleave rather than
    // sitting shoulder to shoulder on one line.
    const reach = i % 2 === 0 ? 1 : RING_INNER_REACH;
    const jitter = scatterJitter(i, 5);
    const xPct = Math.cos(angle) * RING_RX_PCT * reach;
    const yPct = Math.sin(angle) * RING_RY_PCT * reach;
    return {
      angle,
      xPct,
      yPct,
      cx: width * (0.5 + xPct / 100) + jitter.x,
      cy: height * (0.5 + yPct / 100) + jitter.y,
      baseSize: nodeSizeForIndex(i),
      jitter,
    };
  });
}

/**
 * The largest scale at which no node overlaps another node, the card, or the
 * container edge. Nodes are circles at known centres, so each constraint is
 * just "this distance must cover both radii" — solving each for the scale and
 * taking the smallest is exact, not a heuristic. An earlier version compared
 * average arc length per node against node width, which reads as reasonable
 * but guarantees nothing: it says nothing about any *particular* pair, and
 * the ring's sizes and radii both vary per node.
 *
 * The result is free to exceed 1: nodes grow into whatever room the ring
 * leaves them and stop at the first thing they'd touch, so the constellation
 * fills the screen at any size rather than only ever shrinking to fit.
 */
function fitNodeScale(
  slots: RingSlot[],
  width: number,
  height: number,
  cardWidth: number,
): number {
  if (!width || !height || slots.length === 0) return 1;

  let scale = MAX_NODE_SCALE;
  const limit = (available: number, combinedBase: number) => {
    if (combinedBase <= 0) return;
    scale = Math.min(scale, (2 * available) / combinedBase);
  };

  for (const slot of slots) {
    // Container edge: the nearest side bounds the node's radius.
    const toEdge =
      Math.min(slot.cx, slot.cy, width - slot.cx, height - slot.cy) -
      RING_EDGE_MARGIN;
    limit(toEdge, slot.baseSize);

    // The card, treated as a rectangle at the centre: distance from the node
    // to the nearest point on it.
    const dx = Math.max(Math.abs(slot.cx - width / 2) - cardWidth / 2, 0);
    const dy = Math.max(Math.abs(slot.cy - height / 2) - CARD_HEIGHT / 2, 0);
    limit(Math.hypot(dx, dy) - CARD_MIN_GAP, slot.baseSize);
  }

  // Every pair of nodes.
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const gap = Math.hypot(
        slots[i].cx - slots[j].cx,
        slots[i].cy - slots[j].cy,
      );
      limit(gap - NODE_MIN_GAP, slots[i].baseSize + slots[j].baseSize);
    }
  }

  return Math.max(MIN_NODE_SCALE, Math.min(MAX_NODE_SCALE, scale));
}

/**
 * Picks which way a cluster's subcategories fan. Straight outward (away
 * from the card) is the default, but a node sitting near the container edge
 * has no room out there — its satellites would be half off-screen — so the
 * fan rotates until the whole thing fits. Rotations are tried smallest
 * first and alternating in both directions, so a cluster only ever swings
 * as far from "outward" as it actually has to, and only points back toward
 * the card as a last resort.
 */
function chooseFanAngle({
  outward,
  rotationRad,
  nodeX,
  nodeY,
  orbitRadius,
  satelliteSize,
  count,
  width,
  height,
}: {
  outward: number;
  rotationRad: number;
  nodeX: number;
  nodeY: number;
  orbitRadius: number;
  satelliteSize: number;
  count: number;
  width: number;
  height: number;
}): number {
  if (!width || !height) return outward;

  const half = satelliteSize / 2;
  const offsets = fanOffsets(count);
  // The node's wrapper is rotated by the scatter jitter, and the satellites
  // rotate with it — so the on-screen angle is the local angle plus that.
  const fits = (local: number) =>
    offsets.every((offset) => {
      const a = local + offset + rotationRad;
      const x = nodeX + Math.cos(a) * orbitRadius;
      const y = nodeY + Math.sin(a) * orbitRadius;
      return (
        x - half >= RING_EDGE_MARGIN &&
        x + half <= width - RING_EDGE_MARGIN &&
        y - half >= RING_EDGE_MARGIN &&
        y + half <= height - RING_EDGE_MARGIN
      );
    });

  const step = Math.PI / 12; // 15°
  for (let i = 0; i <= 12; i++) {
    for (const direction of i === 0 ? [0] : [1, -1]) {
      const candidate = outward + direction * i * step;
      if (fits(candidate)) return candidate;
    }
  }
  return outward;
}

/** Where each satellite sits within its cluster's fan, as an angular offset
 *  from the fan's centre line. */
function fanOffsets(count: number): number[] {
  if (count <= 1) return [0];
  return Array.from(
    { length: count },
    (_, i) => -FAN_SPREAD_RAD + (2 * FAN_SPREAD_RAD * i) / (count - 1),
  );
}

export function CategorizeScreen({
  transactions,
  categories,
  onCategoryChange,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
  onDelete,
  backHref,
}: {
  transactions: Transaction[];
  categories: Category[];
  onCategoryChange: (id: string, categoryId: string | null) => void;
  onTypeToggle: (id: string, currentType: Transaction["type"]) => void;
  onCardTypeToggle: (
    id: string,
    currentCardType: Transaction["card_type"],
  ) => void;
  onNotesChange: (id: string, notes: string | null) => void;
  onDelete: (id: string) => void;
  backHref: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  // An index into `transactions`, not a queue — Next/Previous just move the
  // pointer, so "skip" and "go back" are the same stepper instead of two
  // separate mechanisms. Categorizing (or deleting) the current transaction
  // removes it from `transactions`, which naturally slides the next one into
  // this same index — no separate "advance" step needed.
  const [index, setIndex] = useState(0);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState<string | null>(null);
  const [newCategoryParentId, setNewCategoryParentId] =
    useState(NO_PARENT_VALUE);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
  const [activeTransaction, setActiveTransaction] =
    useState<Transaction | null>(null);
  // Which drop zone the pointer is currently over mid-drag. Tracked through
  // dnd-kit's own onDragOver rather than the clusters' mouseenter, because
  // the drag captures the pointer — hover events stop reaching the nodes
  // underneath it, so a cluster would never open while you drag toward it.
  const [overId, setOverId] = useState<string | null>(null);
  // How many transactions this session has sorted in a row without a skip —
  // resets on Next (skip) or delete, not on Previous (just reviewing).
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  // Denominator for the progress bar: everything sorted this session plus
  // whatever's left, so it adapts if a rule or new upload adds more.
  const [completedCount, setCompletedCount] = useState(0);
  // Which drop zone to replay the "pop"/confetti animation on, and a key to
  // force that replay even when the same zone is dropped onto twice in a row.
  const [dropPulse, setDropPulse] = useState<{
    id: string;
    key: number;
  } | null>(null);

  const tree = buildCategoryTree(categories);
  const topLevelCategories = tree.map((g) => g.parent);
  const colorMap = buildCategoryColorMap(categories);

  // The ring is sized in percentages but the nodes in pixels, so the
  // constellation has to be measured to know whether those pixels still fit.
  const [ringRef, ringSize] = useElementSize<HTMLDivElement>();
  // The card has to shrink alongside the nodes, or on a narrow window the
  // ring closes in around a card that stayed full width.
  const cardMaxWidth = ringSize.width
    ? Math.min(380, ringSize.width * 0.3)
    : 380;
  const slots = ringLayout(ringSize.width, ringSize.height, tree.length);
  const nodeScale = fitNodeScale(
    slots,
    ringSize.width,
    ringSize.height,
    cardMaxWidth,
  );

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;

    setCreatingCategory(true);
    const { error } = await createCategory(
      supabase,
      categories,
      newCategoryName,
      newCategoryParentId === NO_PARENT_VALUE ? null : newCategoryParentId,
      newCategoryIcon,
    );
    setCreatingCategory(false);

    if (error) {
      toast.error("Failed to create category.");
      return;
    }

    setNewCategoryName("");
    setNewCategoryIcon(null);
    setNewCategoryParentId(NO_PARENT_VALUE);
    setAddingCategory(false);
    router.refresh();
  }

  const clampedIndex =
    transactions.length === 0 ? 0 : Math.min(index, transactions.length - 1);
  const current = transactions[clampedIndex];

  function goToPrevious() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  function goToNext() {
    setStreak(0);
    setIndex((i) => Math.min(i + 1, Math.max(transactions.length - 1, 0)));
  }

  function categorize(id: string, categoryId: string | null) {
    onCategoryChange(id, categoryId);
    setCompletedCount((c) => c + 1);
    setStreak((s) => {
      const next = s + 1;
      setBestStreak((b) => Math.max(b, next));
      return next;
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const activeId = String(event.active.id);
    const found = transactions.find((t) => t.id === activeId);
    if (found) setActiveTransaction(found);
  }

  function handleDragOver(event: DragOverEvent) {
    setOverId(event.over ? String(event.over.id) : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTransaction(null);
    setOverId(null);
    const { active, over } = event;
    if (!over || !current) return;

    categorize(String(active.id), String(over.id));
    setDropPulse({ id: String(over.id), key: Date.now() });
  }

  function handleDragCancel() {
    setActiveTransaction(null);
    setOverId(null);
  }

  function handleDelete(id: string) {
    setStreak(0);
    onDelete(id);
  }

  const progressTotal = completedCount + transactions.length;
  const progressPercent =
    progressTotal > 0 ? Math.round((completedCount / progressTotal) * 100) : 0;
  const level = Math.floor(completedCount / 5) + 1;

  return (
    <div className="game-bg flex flex-1 flex-col h-full overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        // Re-measure droppables continuously: a cluster's subcategories only
        // take up space once it expands mid-drag, so with the default
        // measure-once-at-drag-start they'd keep their collapsed (zero-size)
        // rects and never become droppable.
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className=" flex flex-row items-start justify-between gap-3 border-b bg-background/50 p-2 backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h2 className="text-xs font-bold">Sort it out</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              {transactions.length} uncategorized
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-500">
              <Star className="size-3 fill-amber-400 text-amber-500" />
              Level {level}
              {streak >= 2 && (
                <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-orange-500/10 px-1.5 py-0.5 text-orange-500">
                  <Flame className="size-3" />
                  {streak}
                </span>
              )}
            </span>{" "}
            {progressTotal > 0 && (
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-linear-to-r from-primary via-secondary to-tertiary transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={backHref} />}
          >
            Done
          </Button>
        </div>

        {/* min-h-0 lets this flex child actually shrink to the space left
            over by the header, and overflow-hidden keeps the constellation
            from ever producing a scrollbar. */}
        <div className="relative flex min-h-0 flex-1 flex-col items-center overflow-hidden">
          {current ? (
            <>
              {/* The constellation: the transaction sits at the centre and
                  every category orbits it. Nodes are absolutely positioned
                  on an ellipse, which is what makes expanding a cluster
                  cheap — an absolutely-positioned node can't push its
                  neighbours around, so opening one cluster never reflows
                  the rest (the flow-layout version had to trade compactness
                  against exactly that). Percentages, not pixels, so the ring
                  breathes with the viewport instead of needing a breakpoint. */}
              <div ref={ringRef} className="relative min-h-0 w-full flex-1">
                {tree.map(({ parent, children }, i) => {
                  // Slot positions and base sizes come from ringLayout, the
                  // same source fitNodeScale solved against — so what's drawn
                  // is exactly what was proven not to overlap.
                  const slot = slots[i];
                  const size = Math.round(slot.baseSize * nodeScale);

                  // Cluster geometry is resolved here, not inside
                  // CategoryCluster, because picking a fan direction needs
                  // the node's position within the measured container —
                  // which only this scope knows.
                  const satelliteSize = Math.round(
                    size * subcategorySizeRatio(children.length),
                  );
                  const orbitRadius =
                    size / 2 + satelliteSize / 2 + SATELLITE_GAP;
                  const fanAngle = chooseFanAngle({
                    outward: slot.angle,
                    rotationRad: (slot.jitter.rotationDeg * Math.PI) / 180,
                    nodeX: slot.cx,
                    nodeY: slot.cy,
                    orbitRadius,
                    satelliteSize,
                    count: children.length,
                    width: ringSize.width,
                    height: ringSize.height,
                  });

                  return (
                    <div
                      key={parent.id}
                      className="absolute"
                      style={{
                        left: `calc(50% + ${slot.xPct.toFixed(2)}%)`,
                        top: `calc(50% + ${slot.yPct.toFixed(2)}%)`,
                        transform: `translate(-50%, -50%) translate(${slot.jitter.x}px, ${slot.jitter.y}px) rotate(${slot.jitter.rotationDeg}deg)`,
                      }}
                    >
                      {children.length > 0 ? (
                        <CategoryCluster
                          parent={parent}
                          parentSize={size}
                          satelliteSize={satelliteSize}
                          orbitRadius={orbitRadius}
                          // Points away from the card where there's room to
                          // open, and swings along the edge where there
                          // isn't, so satellites never hang off-screen.
                          fanAngle={fanAngle}
                          subcategories={children}
                          colorMap={colorMap}
                          // Open while the drag is over this cluster, so a
                          // transaction dragged at a parent reveals the
                          // subcategories it can actually be dropped into.
                          dragOver={
                            overId === parent.id ||
                            children.some((c) => c.id === overId)
                          }
                          dropPulse={dropPulse}
                        />
                      ) : (
                        <CategoryDropZone
                          id={parent.id}
                          name={parent.name}
                          icon={parent.icon}
                          size={size}
                          swatch={colorMap.get(parent.id) ?? NEUTRAL_SWATCH}
                          pulseKey={
                            dropPulse?.id === parent.id
                              ? dropPulse.key
                              : undefined
                          }
                        />
                      )}
                    </div>
                  );
                })}

                {/* The transaction at the centre of its own orbit. A
                    carousel, not a forward-only skip queue: Previous steps
                    back to a transaction you already passed, Next moves on
                    without categorizing it — same stepper either way. */}
                {/* pointer-events-none on the wrapper (re-enabled on the
                    controls themselves): it's a z-20 box centred over the
                    ring, so without this its empty margins would swallow
                    drops aimed at the nodes behind it. Clearance from the
                    ring comes from RING_RY_PCT/RING_INNER_REACH, not from
                    padding here, for the same reason. */}
                <div
                  style={{ maxWidth: cardMaxWidth }}
                  className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex w-full -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2 *:pointer-events-auto"
                >
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="shrink-0 rounded-full shadow-sm"
                    onClick={goToPrevious}
                    disabled={clampedIndex === 0}
                    aria-label="Previous transaction"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>

                  <div className="relative w-full max-w-xs ">
                    <GameCard
                      key={current.id}
                      transaction={current}
                      onTypeToggle={() =>
                        onTypeToggle(current.id, current.type)
                      }
                      onCardTypeToggle={() =>
                        onCardTypeToggle(current.id, current.card_type)
                      }
                      onNotesChange={(notes) =>
                        onNotesChange(current.id, notes)
                      }
                      onDelete={() => handleDelete(current.id)}
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="shrink-0 rounded-full shadow-sm"
                    onClick={goToNext}
                    disabled={clampedIndex === transactions.length - 1}
                    aria-label="Next transaction"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Category creation is kept out of the constellation itself —
                  a permanently-visible form competed with the categories for
                  attention. It's a popover off one small button instead, so
                  the form only exists while it's being used and never takes
                  height away from the ring. The trigger stays put whether or
                  not the form is open (an earlier version swapped the button
                  itself for the form, so the thing you'd just clicked moved
                  out from under the cursor). */}
              <div className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2">
                <Popover open={addingCategory} onOpenChange={setAddingCategory}>
                  <PopoverTrigger
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm transition-colors",
                      addingCategory
                        ? "border-primary text-primary"
                        : "border-border/60 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Plus className="size-4" />
                    Add category
                  </PopoverTrigger>

                  <PopoverContent side="top" className="w-80 space-y-3 rounded-2xl">
                    <p className="font-heading text-sm font-bold">New category ✨</p>

                    {/* Icon and name on one line, in that order: the picker
                        previews whatever the name would resolve to on its own,
                        so it reads as "here's your icon, change it if you
                        like" rather than a separate decision to make. */}
                    <div className="flex items-center gap-2">
                      <CategoryIconPicker
                        value={newCategoryIcon}
                        name={newCategoryName}
                        onChange={setNewCategoryIcon}
                        className="size-9"
                      />
                      <Input
                        autoFocus
                        placeholder="Category name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleCreateCategory();
                        }}
                        className="h-9 flex-1"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-secondary">
                        Where does it belong?
                      </label>
                      <Select
                        value={newCategoryParentId}
                        onValueChange={(value) =>
                          setNewCategoryParentId(value ?? NO_PARENT_VALUE)
                        }
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue placeholder="Parent category">
                            {newCategoryParentId === NO_PARENT_VALUE
                              ? "Its own category"
                              : `Under ${
                                  topLevelCategories.find(
                                    (c) => c.id === newCategoryParentId,
                                  )?.name
                                }`}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_PARENT_VALUE}>
                            Its own category
                          </SelectItem>
                          {topLevelCategories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              Under {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => void handleCreateCategory()}
                      disabled={creatingCategory || !newCategoryName.trim()}
                    >
                      <Plus className="size-4" />
                      Add it
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div className="relative">
                <Trophy className="size-12 text-primary" />
                {bestStreak >= 2 && (
                  <div className="absolute inset-0 scale-[4]">
                    <ConfettiBurst burstKey={0} />
                  </div>
                )}
              </div>
              <p className="text-lg font-medium">All caught up!</p>
              {completedCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  Sorted {completedCount}{" "}
                  {completedCount === 1 ? "transaction" : "transactions"} this
                  round
                  {bestStreak >= 2 && (
                    <>
                      {" "}
                      · best streak{" "}
                      <span className="inline-flex items-center gap-0.5 font-semibold text-orange-500">
                        <Flame className="size-3.5" />
                        {bestStreak}
                      </span>
                    </>
                  )}
                </p>
              )}
              <Button
                nativeButton={false}
                render={<Link href={backHref} />}
                className="mt-2"
              >
                Back to overview
              </Button>
            </div>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeTransaction && (
            <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 opacity-95 shadow-xl rotate-3 scale-105">
              <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
              <span className="max-w-40 truncate text-sm font-medium">
                {activeTransaction.description}
              </span>
              <span
                className={cn(
                  "shrink-0 text-sm font-bold tabular-nums",
                  activeTransaction.amount < 0
                    ? "text-primary"
                    : "text-green-600",
                )}
              >
                {formatAmount(activeTransaction.amount)}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

/** The draggable "Stage" card — a bespoke, condensed layout (amount beside
 *  the title, not a footer) that intentionally diverges from the shared
 *  TransactionCard used elsewhere, so it's hand-rolled here rather than
 *  forking that component's API for a single-use look. No category dropdown:
 *  on this screen dragging is the categorization mechanism, same rationale
 *  as the board's compact cards dropping controls that stay one click away
 *  in the overview list. */
function GameCard({
  transaction,
  onTypeToggle,
  onCardTypeToggle,
  onNotesChange,
  onDelete,
}: {
  transaction: Transaction;
  onTypeToggle: () => void;
  onCardTypeToggle: () => void;
  onNotesChange: (notes: string | null) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: transaction.id,
  });
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(transaction.notes ?? "");

  function saveNote() {
    setEditingNote(false);
    const trimmed = noteDraft.trim();
    if (trimmed !== (transaction.notes ?? "")) onNotesChange(trimmed || null);
  }

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        // Layered pink/blue glow: two offset colored shadows plus a neutral
        // depth shadow, so the white card floats over the near-white page
        // without needing a border to separate it.
        "touch-none rounded-md bg-white p-3 transition-opacity",
        "shadow-[-15px_10px_35px_rgba(255,120,200,0.20),15px_10px_35px_rgba(80,180,255,0.20),0_8px_25px_rgba(80,60,120,0.10)]",
        isDragging && "opacity-0",
      )}
    >
      <div className="flex items-start gap-2.5">
        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-semibold"
            title={transaction.description}
          >
            {transaction.description}
          </p>
          {transaction.location && (
            <p
              className="truncate text-xs text-muted-foreground"
              title={transaction.location}
            >
              {transaction.location}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p
            className={cn(
              "text-base font-bold tabular-nums",
              transaction.amount < 0 ? "text-primary" : "text-green-600",
            )}
          >
            {formatAmount(transaction.amount)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatDate(transaction.date)}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onTypeToggle}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] font-medium hover:bg-muted",
            transaction.type === "need_review" &&
              "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {formatTxType(transaction.type)}
        </button>
        <button
          type="button"
          onClick={onCardTypeToggle}
          className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize hover:bg-muted"
        >
          <CreditCard className="size-2.5" />
          {transaction.card_type}
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete transaction"
          className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      {editingNote ? (
        <Textarea
          autoFocus
          rows={2}
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={saveNote}
          placeholder="Add a note…"
          className="mt-2 min-h-0 p-1.5 text-[11px]"
        />
      ) : transaction.notes ? (
        <button
          type="button"
          onClick={() => setEditingNote(true)}
          className="mt-2 w-full rounded-lg bg-muted/60 p-1.5 text-left text-[11px] text-muted-foreground italic hover:text-foreground"
        >
          {transaction.notes}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditingNote(true)}
          className="mt-2 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          + Add note
        </button>
      )}
    </div>
  );
}

/** A parent category node with its subcategories orbiting around it. The
 *  parent keeps its own `parentSize` throughout; subcategories are a fixed
 *  fraction of it (`subcategorySizeRatio`), so the size relationship reads
 *  as parent-and-children whenever they're on screen together. Collapsed,
 *  it shows just the parent plus a "+N" badge; hovering fans the satellites
 *  out along `fanAngle` (the direction pointing away from the constellation's
 *  centre, so subcategories never open back over the transaction card) across
 *  ±FAN_SPREAD_RAD.
 *
 *  The wrapper never changes size — satellites are absolutely positioned and
 *  just overflow it — so expanding a cluster cannot move any other node.
 *
 *  Hover, not "any drag in progress," is what drives this deliberately:
 *  real cursor movement during a drag still fires mouseenter on whatever it
 *  passes over, so a drag reveals a cluster's subcategories exactly when the
 *  cursor reaches it, whereas expanding every cluster the instant *any* drag
 *  started meant a user could aim at a target that moved before they got
 *  there. */
function CategoryCluster({
  parent,
  parentSize,
  satelliteSize,
  orbitRadius,
  fanAngle,
  subcategories,
  colorMap,
  dragOver,
  dropPulse,
}: {
  parent: Category;
  parentSize: number;
  satelliteSize: number;
  orbitRadius: number;
  fanAngle: number;
  subcategories: Category[];
  colorMap: Map<string, CategorySwatch>;
  dragOver: boolean;
  dropPulse: { id: string; key: number } | null;
}) {
  const [hovered, setHovered] = useState(false);
  const expanded = hovered || dragOver;

  // The wrapper stays exactly parent-sized; satellites are absolutely
  // positioned and simply overflow it. Nothing here resizes, so opening a
  // cluster can't disturb any other node's position.
  const centre = parentSize / 2;

  const satelliteOffsets = subcategories.map((c, i) => {
    const angle = fanAngle + fanOffsets(subcategories.length)[i];
    return {
      category: c,
      x: Math.cos(angle) * orbitRadius,
      y: Math.sin(angle) * orbitRadius,
    };
  });

  return (
    <div
      className="relative"
      style={{ width: parentSize, height: parentSize }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Connector lines from the parent's centre to each open satellite —
          drawn in the cluster's own local coordinates (the same x/y used to
          place the satellites below), so no cross-component position
          tracking is needed. Rendered first so later elements stack above. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={parentSize}
        height={parentSize}
      >
        {satelliteOffsets.map(({ category: c, x, y }) => (
          <line
            key={c.id}
            x1={centre}
            y1={centre}
            x2={expanded ? centre + x : centre}
            y2={expanded ? centre + y : centre}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            className="text-rose-300/60 transition-all duration-300 ease-out"
            style={{ opacity: expanded ? 1 : 0 }}
          />
        ))}
      </svg>

      {/* Concentric rings around the selected parent — several very thin,
          translucent borders, not solid circles. Centered on the parent and
          sized off it. */}
      {expanded &&
        SELECTED_RING_GAPS.map((gap) => (
          <div
            key={gap}
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border border-primary/15"
            style={{
              width: parentSize + gap * 2,
              height: parentSize + gap * 2,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}

      {satelliteOffsets.map(({ category: c, x, y }) => (
        <div
          key={c.id}
          className="absolute left-1/2 top-1/2 transition-all duration-300 ease-out"
          style={{
            transform: expanded
              ? `translate(-50%, -50%) translate(${x}px, ${y}px)`
              : "translate(-50%, -50%) scale(0)",
            opacity: expanded ? 1 : 0,
            pointerEvents: expanded ? "auto" : "none",
          }}
        >
          <CategoryDropZone
            id={c.id}
            name={c.name}
            icon={c.icon}
            size={satelliteSize}
            swatch={colorMap.get(c.id) ?? NEUTRAL_SWATCH}
            pulseKey={dropPulse?.id === c.id ? dropPulse.key : undefined}
          />
        </div>
      ))}
      <div className="relative z-10">
        <CategoryDropZone
          id={parent.id}
          name={parent.name}
          icon={parent.icon}
          size={parentSize}
          swatch={colorMap.get(parent.id) ?? NEUTRAL_SWATCH}
          selected={expanded}
          badge={expanded ? undefined : subcategories.length}
          pulseKey={dropPulse?.id === parent.id ? dropPulse.key : undefined}
        />
      </div>
    </div>
  );
}
