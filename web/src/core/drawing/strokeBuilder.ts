import type { Vec3 } from '@/core/interaction/commands';

/** Tuning for air-drawn strokes. */
export const STROKE = {
  /** Add a point only after the pen moved this far on screen (px). */
  minStepPx: 3,
  /** Points per stroke, at most (the live buffer size). */
  maxPoints: 2000,
  /** Strokes shorter than this (ms or px of travel) are taps, not strokes. */
  minDurationMs: 120,
  minTravelPx: 10,
  /** Simplification tolerance as a fraction of the stroke's size. */
  simplify: 0.004,
  /** Catmull-Rom samples between captured points before simplifying. */
  smoothSteps: 4,
} as const;

export interface StrokePoint {
  /** Screen position, px (for spacing and tap detection). */
  screen: { x: number; y: number };
  /** World position on the drawing plane. */
  world: Vec3;
}

/**
 * Collects one stroke's points while the pen (a pinch, or the mouse) is down:
 * a point is added only after the pen moves `minStepPx`, so holding still
 * adds nothing, and the stroke is capped at `maxPoints`. `finish()` smooths
 * and simplifies it, or returns null for a tap.
 */
export class StrokeBuilder {
  readonly points: Vec3[] = [];
  private readonly startedAt: number;
  private last: { x: number; y: number } | null = null;
  private travel = 0;

  constructor(now: number) {
    this.startedAt = now;
  }

  /** Returns true if the point was added. */
  add(p: StrokePoint): boolean {
    if (this.points.length >= STROKE.maxPoints) return false;
    if (this.last) {
      const d = Math.hypot(p.screen.x - this.last.x, p.screen.y - this.last.y);
      if (d < STROKE.minStepPx) return false;
      this.travel += d;
    }
    this.last = { ...p.screen };
    this.points.push([...p.world]);
    return true;
  }

  /** The finished stroke (smoothed, simplified), or null if it was a tap. */
  finish(now: number): Vec3[] | null {
    if (now - this.startedAt < STROKE.minDurationMs || this.travel < STROKE.minTravelPx)
      return null;
    if (this.points.length < 2) return null;
    // Thin the raw points first (half tolerance), so smoothing and the final
    // pass work on a few hundred points instead of thousands: a 2000-point
    // stroke finishes in about a millisecond instead of 10.
    const tol = STROKE.simplify * extent(this.points);
    const smooth = catmullRom(simplify(this.points, tol / 2), STROKE.smoothSteps);
    return simplify(smooth, tol);
  }
}

/** Largest bounding-box side of a point set. */
function extent(points: Vec3[]) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i]!, p[i]!);
      hi[i] = Math.max(hi[i]!, p[i]!);
    }
  return Math.max(hi[0]! - lo[0]!, hi[1]! - lo[1]!, hi[2]! - lo[2]!, 1e-6);
}

/** Uniform Catmull-Rom through the points, `steps` samples per segment. */
export function catmullRom(points: Vec3[], steps: number): Vec3[] {
  if (points.length < 3 || steps < 2) return points.map((p) => [...p] as Vec3);
  const out: Vec3[] = [];
  const at = (i: number) => points[Math.min(points.length - 1, Math.max(0, i))]!;
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        [0, 1, 2].map(
          (k) =>
            0.5 *
            (2 * p1[k]! +
              (-p0[k]! + p2[k]!) * t +
              (2 * p0[k]! - 5 * p1[k]! + 4 * p2[k]! - p3[k]!) * t2 +
              (-p0[k]! + 3 * p1[k]! - 3 * p2[k]! + p3[k]!) * t3),
        ) as Vec3,
      );
    }
  }
  out.push([...points.at(-1)!]);
  return out;
}

/** Ramer–Douglas–Peucker: drop points within `tolerance` of the simplified line. */
export function simplify(points: Vec3[], tolerance: number): Vec3[] {
  if (points.length < 3) return points.map((p) => [...p] as Vec3);
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let worst = -1;
    let worstD = tolerance * tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment2(points[i]!, points[a]!, points[b]!);
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst !== -1) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]).map((p) => [...p] as Vec3);
}

/** Squared distance from p to segment ab (allocation-free: it runs per point per pass). */
function distToSegment2(p: Vec3, a: Vec3, b: Vec3) {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const apx = p[0] - a[0];
  const apy = p[1] - a[1];
  const apz = p[2] - a[2];
  const len2 = abx * abx + aby * aby + abz * abz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / len2)) : 0;
  const dx = apx - abx * t;
  const dy = apy - aby * t;
  const dz = apz - abz * t;
  return dx * dx + dy * dy + dz * dz;
}
