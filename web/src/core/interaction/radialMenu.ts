/**
 * Geometry and hit-testing for the radial menu, independent of rendering.
 *
 * The inner ring has six sectors, the first centered at the top, going
 * clockwise on screen. Some open an outer ring of choices (Add, Color); the
 * outer ring's items are centered on their parent sector's angle.
 */
export type MenuAction = 'add' | 'draw' | 'color' | 'undo' | 'delete' | 'clear';

export const MENU_ACTIONS: readonly MenuAction[] = [
  'add',
  'draw',
  'color',
  'undo',
  'delete',
  'clear',
];

export const MENU_GEOMETRY = {
  /** Within this radius (px) nothing is highlighted: pinching there cancels. */
  deadZone: 38,
  innerOuter: 118,
  outerOuter: 188,
} as const;

/** Angle (radians, screen y down, 0 = up, clockwise) of inner sector `i`'s center. */
export function sectorAngle(i: number, count = MENU_ACTIONS.length) {
  return (i * 2 * Math.PI) / count;
}

/** Item width (radians) in an outer ring. */
export function outerStep(count: number) {
  return count > 4 ? (2 * Math.PI) / count : Math.PI / 5;
}

/** Angle of outer item `j` of `count`, around the parent sector `parent`. */
export function outerAngle(parent: number, j: number, count: number) {
  // Many items wrap the whole ring, starting at the parent; a few fan out
  // around the parent's direction.
  if (count > 4) return sectorAngle(parent) + j * outerStep(count);
  return sectorAngle(parent) + (j - (count - 1) / 2) * outerStep(count);
}

const wrap = (a: number) => {
  const t = a % (2 * Math.PI);
  return t < 0 ? t + 2 * Math.PI : t;
};

/** Screen angle (0 = up, clockwise) of an offset from the menu center. */
export function screenAngle(dx: number, dy: number) {
  return wrap(Math.atan2(dx, -dy));
}

export type MenuHit =
  { ring: 'none' } | { ring: 'inner'; index: number } | { ring: 'outer'; index: number };

/**
 * What a pointer at offset (dx, dy) from the menu center points at. `outer`
 * is the number of items in the open outer ring (0 if none) and its parent
 * sector. Beyond the inner ring, with no outer ring open, the inner sector in
 * that direction stays highlighted, so a hand that overshoots still works.
 */
/**
 * How far past a sector's edge the pointer must go before the highlight moves
 * on, as a fraction of the sector's half-width, and how far inside the center
 * circle it must come back before nothing is highlighted. Hands drift a little;
 * this keeps small drifts from hopping to a neighbor.
 */
export const STICKY = {
  sector: 0.45,
  ring: 12,
  deadZone: 0.75,
} as const;

/** Unsigned angle between two directions, in [0, π]. */
const angleGap = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

/**
 * What a pointer at offset (dx, dy) from the menu center points at. `outer`
 * is the open outer ring (its item count and parent sector), if any. Beyond
 * the inner ring with no outer ring open, the inner sector in that direction
 * stays highlighted, so a hand that overshoots still works.
 *
 * With `prev` (the current highlight), the result is sticky (see `STICKY`): a
 * highlighted item keeps the highlight until the pointer is clearly inside
 * another one.
 */
export function hitTest(
  dx: number,
  dy: number,
  outer: { parent: number; count: number } | null,
  prev: MenuHit = { ring: 'none' },
): MenuHit {
  const r = Math.hypot(dx, dy);
  const G = MENU_GEOMETRY;
  // Leaving the center takes the full dead zone; coming back takes more.
  if (r < (prev.ring === 'none' ? G.deadZone : G.deadZone * STICKY.deadZone)) {
    return { ring: 'none' };
  }
  const a = screenAngle(dx, dy);
  const n = MENU_ACTIONS.length;
  const half = Math.PI / n;

  if (outer && outer.count > 0) {
    const step = outerStep(outer.count);
    const centerOf = (j: number) => outerAngle(outer.parent, j, outer.count);
    // Stay on the outer item while still near it (in angle and radius).
    if (
      prev.ring === 'outer' &&
      r >= G.innerOuter - STICKY.ring &&
      angleGap(a, centerOf(prev.index)) <= (step / 2) * (1 + STICKY.sector)
    ) {
      return prev;
    }
    const outward = prev.ring === 'outer' ? G.innerOuter - STICKY.ring : G.innerOuter;
    if (r >= outward) {
      for (let j = 0; j < outer.count; j++) {
        if (angleGap(a, centerOf(j)) <= step / 2) return { ring: 'outer', index: j };
      }
      // Outside the fan of a short outer ring: fall back to the inner sector.
    }
  }

  if (prev.ring === 'inner' && angleGap(a, sectorAngle(prev.index)) <= half * (1 + STICKY.sector)) {
    return prev;
  }
  return { ring: 'inner', index: Math.round(a / (2 * half)) % n };
}
