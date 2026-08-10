"use client";

import { useDroppable } from "@dnd-kit/core";
import { ConfettiBurst } from "@/components/confetti-burst";
import { BLOB_SHAPE_CLASS } from "@/lib/organic-shapes";
import { cn } from "@/lib/utils";
import type { CategorySwatch } from "@/lib/category-colors";

export function CategoryDropZone({
  id,
  name,
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
  size: number;
  swatch: CategorySwatch;
  selected?: boolean;
  badge?: number;
  pulseKey?: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const fontSize = selected
    ? "text-[13px]"
    : size >= 100
      ? "text-[12px]"
      : size >= 76
        ? "text-[11px]"
        : "text-[9px]";
  // Padding scales with blob size — a fixed padding would leave almost no
  // room for text on the smallest satellite blobs (56px).
  const padding = size >= 100 ? "p-4" : size >= 76 ? "p-3" : "p-2";

  return (
    // The drop target's own hit area is a plain (unclipped) box, slightly
    // more generous than the shape painted inside it — the "+N" badge lives
    // outside that inner shape so it isn't clipped along with it.
    <div
      ref={setNodeRef}
      style={{ width: size, height: size }}
      className={cn(
        "relative shrink-0 transition-[width,height,transform] duration-200",
        isOver && "scale-110",
      )}
    >
      <div
        className={cn(
          "flex size-full select-none items-center justify-center bg-linear-to-br text-center font-medium text-neutral-800 transition-[background,box-shadow]",
          BLOB_SHAPE_CLASS,
          selected ? swatch.gradientSelected : swatch.gradient,
          fontSize,
          padding,
          selected
            ? "shadow-[0_10px_30px_rgba(80,60,150,0.18),0_0_35px_rgba(200,120,220,0.35)]"
            : "shadow-sm",
          isOver && "shadow-lg",
        )}
      >
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
        <span className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full border border-black/5 bg-white text-[11px] font-semibold text-neutral-700 shadow-sm">
          +{badge}
        </span>
      )}
      {pulseKey !== undefined && <ConfettiBurst burstKey={pulseKey} />}
    </div>
  );
}
