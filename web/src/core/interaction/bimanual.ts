/**
 * Two-hand manipulation from geometry alone.
 *
 * Two grip points (where each hand's ray meets the camera-facing plane through
 * the object) drive the object as if it were held at those points:
 * - translation follows their midpoint,
 * - scale follows the ratio of their separation to the separation at the start,
 * - roll follows the angle of the line between them, in the view plane.
 *
 * Scale and roll pivot on the object's own center by default, so an object
 * held from a distance (hands off to one side, or far apart) turns and grows in
 * place instead of orbiting the hands. With `pivot: 'hands'` they pivot on the
 * midpoint instead, which keeps the object under the fingers. Every pose is
 * computed from a snapshot taken when the grip starts (never by summing
 * per-frame deltas), so the first frame reproduces the starting pose exactly
 * and nothing drifts. Callers take a new snapshot whenever the set of hands
 * changes.
 */
import { OneEuroFilter, type OneEuroParams } from '@/core/tracking/oneEuro';
import {
  quatFromAxisAngle,
  quatMultiply,
  quatNormalize,
  quatRotateVec3,
  type Quat,
} from '@/core/math/quat';
import type { Vec3 } from './commands';

export interface Pose {
  position: Vec3;
  rotation: Quat;
  scale: number;
}

/** World-space camera axes. `right` × `up` points toward the viewer. */
export interface ViewBasis {
  right: Vec3;
  up: Vec3;
}

export interface BimanualOptions {
  /** What scale and roll turn around: the object's center, or the hands' midpoint. */
  pivot: 'object' | 'hands';
  scaleMin: number;
  scaleMax: number;
  /** Log-space band below each scale limit where scaling eases into the limit. */
  softBand: number;
  /** Scale changes smaller than this (log ratio) are ignored. */
  scaleDeadZone: number;
  /** Roll smaller than this (radians) is ignored. */
  rollDeadZone: number;
  /** Below this hand separation (world units) scale and roll hold. */
  minSeparation: number;
  scaleFilter: OneEuroParams;
  rollFilter: OneEuroParams;
}

export const DEFAULT_BIMANUAL_OPTIONS: BimanualOptions = {
  pivot: 'object',
  scaleMin: 0.3,
  scaleMax: 3,
  softBand: Math.log(1.15),
  scaleDeadZone: 0.03,
  rollDeadZone: (2 * Math.PI) / 180,
  minSeparation: 0.35,
  scaleFilter: { minCutoff: 1.2, beta: 1.0, dCutoff: 1.0 },
  rollFilter: { minCutoff: 1.0, beta: 0.6, dCutoff: 1.0 },
};

/** Two points (one per hand, same order as the grips) to measure scale and roll from. */
export type Span = readonly [Readonly<Vec3>, Readonly<Vec3>];

export interface BimanualResult extends Pose {
  /** Scale relative to the snapshot, after limits. */
  scaleFactor: number;
  /** Raw hand spread relative to the snapshot (before smoothing, dead zone and limits). */
  spread: number;
  /** Raw turn of the hand line since the snapshot, radians (before smoothing and dead zone). */
  turn: number;
  /** Roll since the snapshot, radians, counter-clockwise on screen. */
  roll: number;
  /** The scale target is at or beyond a limit. */
  atLimit: boolean;
  /** Hands too close together: scale and roll are holding. */
  holding: boolean;
}

const sub = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Readonly<Vec3>, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Readonly<Vec3>, b: Readonly<Vec3>) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const mid = (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => mul(add(a, b), 0.5);

/** Continuous dead zone: values inside ±t become 0, outside are shifted by t. */
export function softDeadZone(x: number, t: number): number {
  const m = Math.abs(x) - t;
  return m > 0 ? Math.sign(x) * m : 0;
}

/**
 * Ease a log-scale value into [lo, hi]. Inside the band below a limit the curve
 * flattens smoothly (matching slope at the band's start) and reaches the limit
 * exactly when the raw value is a band past it.
 */
export function softClampLog(l: number, lo: number, hi: number, band: number): number {
  const ease = (u: number) => (u >= 2 * band ? band : u - (u * u) / (4 * band));
  if (l > hi - band) return hi - band + ease(l - (hi - band));
  if (l < lo + band) return lo + band - ease(lo + band - l);
  return l;
}

/** Inverse of `softClampLog` on [lo, hi]. Values at a limit map to a band past it. */
export function softUnclampLog(y: number, lo: number, hi: number, band: number): number {
  const unease = (v: number) => (v >= band ? 2 * band : 2 * band * (1 - Math.sqrt(1 - v / band)));
  if (y > hi - band) return hi - band + unease(y - (hi - band));
  if (y < lo + band) return lo + band - unease(lo + band - y);
  return y;
}

/** Shortest signed difference a − b, in (−π, π]. */
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

interface Snapshot {
  pose: Pose;
  /** Midpoint of the grips at the snapshot. */
  pivot: Vec3;
  /** log(separation) at the snapshot. */
  logSep: number;
  /** Screen-plane angle of the hand line at the snapshot. */
  angle: number;
}

export class BimanualGrip {
  private readonly opts: BimanualOptions;
  private readonly view: ViewBasis;
  /** Toward the viewer: the axis that on-screen counter-clockwise roll turns about. */
  private readonly rollAxis: Vec3;
  private snap!: Snapshot;
  private holding = false;
  /** Unwrapped angle, so turning past 180° keeps going. */
  private angle = 0;
  private readonly scaleFilter: OneEuroFilter;
  private readonly rollFilter: OneEuroFilter;
  private last!: BimanualResult;

  constructor(
    start: Pose,
    a: Readonly<Vec3>,
    b: Readonly<Vec3>,
    view: ViewBasis,
    tMs: number,
    opts: Partial<BimanualOptions> = {},
    span?: Span,
  ) {
    this.opts = { ...DEFAULT_BIMANUAL_OPTIONS, ...opts };
    this.view = view;
    this.rollAxis = cross(view.right, view.up);
    this.scaleFilter = new OneEuroFilter(this.opts.scaleFilter);
    this.rollFilter = new OneEuroFilter(this.opts.rollFilter);
    this.rebase(start, a, b, tMs, span);
  }

  /** Current output, without new input. */
  get result(): BimanualResult {
    return this.last;
  }

  /**
   * Start again from `pose` with the given grips, e.g. after a hand returns.
   * The next update with the same grips returns `pose` unchanged.
   *
   * `span` (optional) gives separate points to measure scale and roll from,
   * e.g. the fingertips, which can come closer together than the grips.
   */
  rebase(pose: Pose, a: Readonly<Vec3>, b: Readonly<Vec3>, tMs: number, span?: Span) {
    const d = span ? sub(span[1], span[0]) : sub(b, a);
    const sep = Math.hypot(d[0], d[1], d[2]);
    this.holding = sep < this.opts.minSeparation;
    this.angle = this.screenAngle(d);
    this.snap = {
      pose: { position: [...pose.position], rotation: [...pose.rotation], scale: pose.scale },
      pivot: mid(a, b),
      logSep: Math.log(Math.max(sep, 1e-6)),
      angle: this.angle,
    };
    this.scaleFilter.reset();
    this.rollFilter.reset();
    this.scaleFilter.filter(0, tMs);
    this.rollFilter.filter(0, tMs);
    this.last = {
      ...this.snap.pose,
      position: [...pose.position],
      rotation: [...pose.rotation],
      scaleFactor: 1,
      spread: 1,
      turn: 0,
      roll: 0,
      atLimit: false,
      holding: this.holding,
    };
  }

  update(a: Readonly<Vec3>, b: Readonly<Vec3>, tMs: number, span?: Span): BimanualResult {
    const o = this.opts;
    const d = span ? sub(span[1], span[0]) : sub(b, a);
    const sep = Math.hypot(d[0], d[1], d[2]);

    // Hands too close: the angle and ratio are unstable. Hold scale and roll,
    // keep translating, and re-snapshot on both edges so neither jumps.
    const tooClose = sep < (this.holding ? o.minSeparation * 1.2 : o.minSeparation);
    if (tooClose !== this.holding) {
      this.rebase(this.last, a, b, tMs, span);
      this.holding = tooClose;
      this.last = { ...this.last, holding: tooClose };
      return this.last;
    }

    const pivot = mid(a, b);
    let logK = 0;
    let roll = 0;
    if (!this.holding) {
      this.angle += angleDiff(this.screenAngle(d), this.angle);
      const rawLogK = Math.log(Math.max(sep, 1e-6)) - this.snap.logSep;
      logK = this.scaleFilter.filter(softDeadZone(rawLogK, o.scaleDeadZone), tMs);
      roll = this.rollFilter.filter(
        softDeadZone(this.angle - this.snap.angle, o.rollDeadZone),
        tMs,
      );
    }

    const s0 = this.snap.pose.scale;
    const lo = Math.log(o.scaleMin);
    const hi = Math.log(o.scaleMax);
    // Work in "unclamped" space so a snapshot taken inside the soft band (or at
    // a limit) reproduces its own scale exactly.
    const rawLog = softUnclampLog(Math.log(s0), lo, hi, o.softBand) + logK;
    const scale = Math.exp(softClampLog(rawLog, lo, hi, o.softBand));
    const k = scale / s0;

    const turn = quatFromAxisAngle(this.rollAxis, roll);
    const planar =
      o.pivot === 'hands'
        ? add(pivot, quatRotateVec3(turn, mul(sub(this.snap.pose.position, this.snap.pivot), k)))
        : add(this.snap.pose.position, sub(pivot, this.snap.pivot));
    this.last = {
      position: planar,
      rotation: quatNormalize(quatMultiply(turn, this.snap.pose.rotation)),
      scale,
      scaleFactor: k,
      spread: Math.exp(Math.log(Math.max(sep, 1e-6)) - this.snap.logSep),
      turn: this.angle - this.snap.angle,
      roll,
      atLimit: rawLog >= hi || rawLog <= lo,
      holding: this.holding,
    };
    return this.last;
  }

  private screenAngle(d: Readonly<Vec3>) {
    return Math.atan2(dot(d, this.view.up), dot(d, this.view.right));
  }
}
