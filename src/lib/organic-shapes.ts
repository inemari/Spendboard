/**
 * Deterministic "randomness" for the categorize screen's scatter layout —
 * jittering blobs off their grid slot needs per-item variety that's stable
 * across renders (same category always gets the same offset) without an
 * actual seeded RNG dependency. This hash trick (classic in shader code)
 * maps an index to a stable pseudo-random value in [0, 1).
 */
function pseudoRandom(seed: number): number {
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  return n - Math.floor(n);
}

/** The category blob silhouette: a rounded square with three heavily
 *  rounded corners and one tighter corner — soft and geometric, the same
 *  shape for every blob. Deliberately NOT randomized per category (an
 *  earlier version varied the outline itself, which read as "randomly
 *  organic" rather than a consistent design language); only size varies. */
export const BLOB_SHAPE_CLASS = "rounded-[45%_45%_12%_45%]";

/** A small, stable (x, y, rotation) offset for scattering an item away from
 *  its grid slot — the categorize screen's category grid uses this so blobs
 *  read as a loose cluster instead of a rigid aligned grid. Magnitude is
 *  caller-controlled since a leaf blob and a whole cluster wrapper want
 *  different amounts of wobble. */
export function scatterJitter(
  index: number,
  magnitudePx: number,
): { x: number; y: number; rotationDeg: number } {
  // Rounded to 2dp: server and client otherwise embed the same value at
  // different floating-point string lengths (e.g. "6.96365" vs
  // "6.963648482385906"), which React sees as a genuine mismatch and
  // reports as a hydration error even though the underlying value agrees.
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    x: round((pseudoRandom(index * 12.9898) * 2 - 1) * magnitudePx),
    y: round((pseudoRandom(index * 78.233) * 2 - 1) * magnitudePx),
    rotationDeg: round((pseudoRandom(index * 39.346) * 2 - 1) * 3),
  };
}
