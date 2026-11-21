/**
 * Two-hand manipulation from geometry alone.
 *
 * Two grip points (where each hand's ray meets the camera-facing plane through
 * the object) drive the object as if it were held at those points:
 * - translation follows their midpoint,
 * - scale follows the ratio of their separation to the separation at the start,
 * - roll follows the angle of the line between them, in the view plane.
 *
 * The pivot is the midpoint, so the object stays under the hands. Every pose is
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
  scaleMin: 0.3,
  scaleMax: 3,
  softBand: Math.log(1.15),
  scaleDeadZone: 0.03,
  rollDeadZone: (2 * Math.PI) / 180,
  minSeparation: 0.35,
  scaleFilter: { minCutoff: 1.2, beta: 1.0, dCutoff: 1.0 },
  rollFilter: { minCutoff: 1.0, beta: 0.6, dCutoff: 1.0 },
};

export interface BimanualResult extends Pose {
  /** Scale relative to the snapshot, after limits. */
  scaleFactor: number;
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
  ) {
    this.opts = { ...DEFAULT_BIMANUAL_OPTIONS, ...opts };
    this.view = view;
    this.rollAxis = cross(view.right, view.up);
    this.scaleFilter = new OneEuroFilter(this.opts.scaleFilter);
    this.rollFilter = new OneEuroFilter(this.opts.rollFilter);
    this.rebase(start, a, b, tMs);
  }

  /** Current output, without new input. */
  get result(): BimanualResult {
    return this.last;
  }

  /**
   * Start again from `pose` with the given grips, e.g. after a hand returns.
   * The next update with the same grips returns `pose` unchanged.
   */
  rebase(pose: Pose, a: Readonly<Vec3>, b: Readonly<Vec3>, tMs: number) {
    const d = sub(b, a);
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
      roll: 0,
      atLimit: false,
      holding: this.holding,
    };
  }

  update(a: Readonly<Vec3>, b: Readonly<Vec3>, tMs: number): BimanualResult {
    const o = this.opts;
    const d = sub(b, a);
    const sep = Math.hypot(d[0], d[1], d[2]);

    // Hands too close: the angle and ratio are unstable. Hold scale and roll,
    // keep translating, and re-snapshot on both edges so neither jumps.
    const tooClose = sep < (this.holding ? o.minSeparation * 1.2 : o.minSeparation);
    if (tooClose !== this.holding) {
      this.rebase(this.last, a, b, tMs);
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
    const offset = quatRotateVec3(turn, mul(sub(this.snap.pose.position, this.snap.pivot), k));
    this.last = {
      position: add(pivot, offset),
      rotation: quatNormalize(quatMultiply(turn, this.snap.pose.rotation)),
      scale,
      scaleFactor: k,
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
