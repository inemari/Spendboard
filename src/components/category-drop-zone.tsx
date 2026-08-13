"use client";

import type { LucideIcon } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { ConfettiBurst } from "@/components/confetti-burst";
import { categoryIcon } from "@/lib/category-icons";
import { NODE_SHAPE_CLASS } from "@/lib/organic-shapes";
import { cn } from "@/lib/utils";
import type { CategorySwatch } from "@/lib/category-colors";

/** Renders a resolved icon component. A wrapper rather than a capitalized
 *  local, which React's lint rules read as a component declared during
 *  render — the component itself is looked up from the saved slug. */
function IconGlyph({
  icon: Icon,
  size,
  className,
}: {
  icon: LucideIcon;
  size: number;
  className?: string;
}) {
  return <Icon size={size} strokeWidth={1.75} className={className} />;
}

export function CategoryDropZone({
  id,
  name,
  /** The category's own icon slug. Drawn above the label so a node is
   *  recognizable at a glance mid-drag — while dragging, the label is what
   *  you're least able to read, since the cursor and the dragged card are
   *  moving across the ring. Null falls back to a guess from the name, the
   *  same as the overview sidebar. */
  icon,
  /** Blob diameter in px — varied per category by the caller so the grid
   *  reads as bubbles of different sizes/importance, not a uniform grid of
   *  identical shapes. The silhouette itself never varies (BLOB_SHAPE_CLASS
   *  is one consistent rounded shape) — only size does. */
  size,
  swatch,
  /** True for the one category currently expanded/hovered — bigger glow,
   *  a richer version of the category's own gradient, and concentric rings
   *  (rendered by the caller, CategoryCluster, since they need to sit
   *  outside this element's own clipped/sized box). */
  selected,
  /** Collapsed-state overflow count — shown as a "+N" pill when this blob's
   *  subcategories are folded away (see CategoryCluster in categorize-screen). */
  badge,
  /** Bumped by the parent on every successful drop onto this zone — keying
   *  the inner element on it forces a remount so the pop animation (and the
   *  confetti burst) replay each time, not just on first mount. */
  pulseKey,
}: {
  id: string;
  name: string;
  icon?: string | null;
  size: number;
  swatch: CategorySwatch;
  selected?: boolean;
  badge?: number;
  pulseKey?: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  // Both scale with the node's size: subcategory nodes are a half or a
  // third of their parent, so a single fixed type size/padding would either
  // overflow the small ones or look lost on the large ones.
  const fontSize =
    size >= 120
      ? "text-[13px]"
      : size >= 90
        ? "text-[12px]"
        : size >= 64
          ? "text-[11px]"
          : "text-[9px]";
  const padding =
    size >= 120 ? "p-4" : size >= 90 ? "p-3" : size >= 64 ? "p-2" : "p-1";
  // The icon scales with the node rather than taking a fixed size, for the
  // same reason the type does — a node can be anywhere from a full-size
  // parent to a third-size satellite. Below ~52px there isn't room for both
  // a glyph and a readable label, and the label is the one that identifies
  // the category, so the smallest satellites go icon-less.
  const iconSize =
    size >= 52 ? Math.round(Math.min(40, Math.max(14, size * 0.26))) : 0;
  const glyph = categoryIcon(icon, name);

  return (
    // The drop target's own hit area is a plain (unclipped) box, slightly
    // more generous than the shape painted inside it — both so the "+N"
    // badge (which lives outside the inner shape) isn't clipped along with
    // it, and so the target is a little easier to drop onto than the circle
    // alone would be. The inner shape stays pinned to exactly `size`, not a
    // percentage of this box: the constellation's overlap-free layout
    // (fitNodeScale/chooseFanAngle/clusterFootprint in categorize-screen.tsx)
    // treats every node — and every cluster's full satellite fan — as a
    // circle of exactly this diameter, so growing the *painted* circle past
    // `size` reintroduces the overlaps that math promises are impossible.
    // This has already regressed once before from a padding change that
    // grew this box without re-pinning the inner shape — if this box's
    // padding needs to change again, this inner div must stay untouched.
    <div
      ref={setNodeRef}
      style={{ width: size, height: size }}
      className={cn(
        "relative flex shrink-0 items-center justify-center transition-[width,height,transform] duration-200",
        isOver && "scale-110",
      )}
    >
      <div
        style={{ width: size, height: size }}
        className={cn(
          // min-width/min-height must stay off this box: with an explicit
          // pixel width/height set via style above, a min-w-fit here would
          // still win per the CSS box model and stretch the circle wide
          // enough to fit the label unwrapped — which is exactly how a long
          // category name ends up rendering outside its own shape.
          "flex select-none flex-col items-center justify-center gap-1 bg-linear-to-br text-center font-medium text-neutral-800 transition-[background,box-shadow]",
          NODE_SHAPE_CLASS,
          selected ? swatch.gradientSelected : swatch.gradient,
          fontSize,
          padding,
          selected
            ? "shadow-[0_10px_30px_rgba(80,60,150,0.18),0_0_35px_rgba(200,120,220,0.35)]"
            : "shadow-sm",
          isOver && "shadow-lg",
        )}
      >
        {iconSize > 0 && (
          // Sized by prop, not a utility class: the value is derived from the
          // node's own pixel size, which no fixed class can express.
          <IconGlyph
            icon={glyph}
            size={iconSize}
            className={cn(
              "shrink-0 text-neutral-800/75 transition-transform duration-200",
              isOver && "scale-110",
            )}
          />
        )}
        <p
          key={pulseKey ?? "static"}
          className={cn(
            "relative w-full wrap-break-word leading-tight",
            selected && "font-semibold",
            pulseKey !== undefined && "animate-in zoom-in-125 duration-300",
          )}
        >
          {name}
        </p>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full border border-black/5 bg-white text-[11px] font-semibold text-neutral-700 shadow-sm">
          +{badge}
        </span>
      )}
      {pulseKey !== undefined && <ConfettiBurst burstKey={pulseKey} />}
    </div>
  );
}
