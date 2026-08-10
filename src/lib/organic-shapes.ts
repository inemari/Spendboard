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

/** The category node silhouette: a square with softly rounded corners —
 *  the same shape for every node. Deliberately NOT randomized per category
 *  (an earlier version varied the outline itself, which read as "randomly
 *  organic" rather than a consistent design language); only size varies. */
export const NODE_SHAPE_CLASS = "rounded-full";

/** Top-level category nodes are sized pseudo-randomly in this range so the
 *  cluster reads as varied rather than a uniform grid. */
export const NODE_MIN_SIZE = 120;
export const NODE_MAX_SIZE = 160;

/**
 * A stable size in [NODE_MIN_SIZE, NODE_MAX_SIZE] for the category at
 * `index`. Seeded off the index rather than `Math.random()` on purpose:
 * a real random call would (a) pick a different value on the server than
 * on the client, which React reports as a hydration mismatch, and (b)
 * reshuffle every node's size on each re-render. Rounded to a whole pixel
 * for the same hydration reason — fractional values can serialize to
 * different string lengths on either side.
 */
export function nodeSizeForIndex(index: number): number {
  const t = pseudoRandom(index * 45.164 + 5.3);
  return Math.round(NODE_MIN_SIZE + t * (NODE_MAX_SIZE - NODE_MIN_SIZE));
}

/**
 * How big a subcategory node is relative to its parent: a third once there
 * are more than three of them (so a wide fan still fits), otherwise a half.
 */
export function subcategorySizeRatio(subcategoryCount: number): number {
  return subcategoryCount > 3 ? 1 / 3 : 1 / 2;
}

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
