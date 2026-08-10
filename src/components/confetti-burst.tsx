import type { CSSProperties } from "react";

const COLORS = [
  "#f43f5e",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#f97316",
];

const PIECE_COUNT = 12;

/** A one-shot burst of colored dots radiating from center, replayed by
 *  remounting with a new `burstKey` (usually Date.now() from the caller). */
export function ConfettiBurst({ burstKey }: { burstKey: number }) {
  return (
    <div
      key={burstKey}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 overflow-visible"
    >
      {Array.from({ length: PIECE_COUNT }, (_, i) => {
        const angle = (i / PIECE_COUNT) * 360;
        const distance = 28 + (i % 3) * 14;
        const dx = Math.cos((angle * Math.PI) / 180) * distance;
        const dy = Math.sin((angle * Math.PI) / 180) * distance;
        return (
          <span
            key={i}
            className="absolute left-1/2 top-1/2 size-1.5 rounded-full animate-confetti-piece"
            style={
              {
                backgroundColor: COLORS[i % COLORS.length],
                "--confetti-dx": `${dx}px`,
                "--confetti-dy": `${dy}px`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
