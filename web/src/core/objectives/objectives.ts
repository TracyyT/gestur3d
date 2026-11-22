import type { ObjectKind, SceneModel, SceneObject, Vec3 } from '@/core/interaction/commands';
import type { Quat } from '@/core/math/quat';

/**
 * Objectives: small, forgiving checks that Practice lessons and Playground
 * levels are built from. Each is fed a snapshot every frame and reports
 * progress (0–1), whether it's done, and a short hint. They hold their own
 * timers, so "hold it there for a second" survives a frame or two of jitter.
 */

export interface HandSnapshot {
  id: number;
  /** Inside the reach box, tracked (not lost). */
  inView: boolean;
  hoverId: string | null;
  grabbedId: string | null;
}

export interface ObjectiveContext {
  /** ms, monotonic. */
  t: number;
  scene: SceneModel;
  hands: HandSnapshot[];
  menuOpen: boolean;
}

export interface ObjectiveState {
  progress: number;
  done: boolean;
  hint?: string;
}

export interface Objective {
  update(ctx: ObjectiveContext): ObjectiveState;
  reset(): void;
}

/** Brief misses (tracking jitter) don't reset a hold. */
export const HOLD_GRACE_MS = 200;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const find = (scene: SceneModel, id: string) => scene.objects.find((o) => o.id === id);

/**
 * Accumulates time while a condition holds. A miss shorter than the grace
 * pauses the timer; a longer one resets it. Once done, it stays done.
 */
export class HoldTimer {
  private held = 0;
  private last: number | null = null;
  private missSince: number | null = null;
  private finished = false;

  readonly holdMs: number;
  readonly graceMs: number;

  constructor(holdMs: number, graceMs = HOLD_GRACE_MS) {
    this.holdMs = holdMs;
    this.graceMs = graceMs;
  }

  update(t: number, ok: boolean): number {
    if (this.finished) return 1;
    if (ok) {
      if (this.last !== null && this.missSince === null) this.held += t - this.last;
      this.missSince = null;
      this.last = t;
    } else {
      this.missSince ??= t;
      this.last = t;
      if (t - this.missSince > this.graceMs) this.held = 0;
    }
    if (this.holdMs <= 0 ? ok : this.held >= this.holdMs) this.finished = true;
    return this.finished ? 1 : clamp01(this.held / Math.max(1, this.holdMs));
  }

  reset() {
    this.held = 0;
    this.last = null;
    this.missSince = null;
    this.finished = false;
  }
}

/** A condition over the context that must hold for `holdMs`. */
function held(
  holdMs: number,
  check: (ctx: ObjectiveContext) => { ok: boolean; hint?: string; partial?: number },
): Objective {
  const timer = new HoldTimer(holdMs);
  return {
    update(ctx) {
      const r = check(ctx);
      const p = timer.update(ctx.t, r.ok);
      const done = p >= 1;
      // Before the hold starts, show how close the condition is (if known).
      const progress = done ? 1 : r.ok ? 0.5 + p / 2 : (r.partial ?? 0) / 2;
      // While the condition holds, the hint is about holding, not the original ask.
      const hint = r.ok ? 'Hold it there…' : r.hint;
      return { progress, done, ...(done || !hint ? {} : { hint }) };
    },
    reset: () => timer.reset(),
  };
}

/** `count` hands tracked inside the reach box for `holdMs` in total. */
export function handsInView(count: 1 | 2, holdMs = 2000): Objective {
  return held(holdMs, ({ hands }) => {
    const n = hands.filter((h) => h.inView).length;
    return {
      ok: n >= count,
      partial: n / count,
      hint:
        count === 1
          ? 'Raise one hand into view'
          : n === 1
            ? 'Now the other hand too'
            : 'Raise both hands',
    };
  });
}

/** Hover each target in turn for `dwellMs`, with any hand. */
export function hoverEach(targets: string[], dwellMs = 400): Objective {
  let index = 0;
  const timer = new HoldTimer(dwellMs, 120);
  return {
    update(ctx) {
      if (index < targets.length) {
        const id = targets[index]!;
        if (
          timer.update(
            ctx.t,
            ctx.hands.some((h) => h.hoverId === id),
          ) >= 1
        ) {
          index++;
          timer.reset();
        }
      }
      const done = index >= targets.length;
      return {
        progress: done ? 1 : index / targets.length,
        done,
        ...(done ? {} : { hint: `Point at target ${index + 1} of ${targets.length}` }),
      };
    },
    reset() {
      index = 0;
      timer.reset();
    },
  };
}

/** The object's center within `radius` of `center`, released (or held) for `holdMs`. */
export function objectInZone(
  id: string,
  center: Vec3,
  radius: number,
  { holdMs = 300, released = true }: { holdMs?: number; released?: boolean } = {},
): Objective {
  return held(holdMs, ({ scene, hands }) => {
    const o = find(scene, id);
    if (!o) return { ok: false, hint: 'The object is gone. Retry to bring it back.' };
    const d = dist(o.position, center);
    const inside = d <= radius;
    const holding = hands.some((h) => h.grabbedId === id);
    if (inside && released && holding) return { ok: false, partial: 0.9, hint: 'Now let go' };
    return {
      ok: inside,
      partial: clamp01(1 - (d - radius) / (radius * 4)),
      hint: holding ? 'Carry it into the ring' : 'Pinch the object to grab it',
    };
  });
}

/** Scale within ±`tolerance` (relative) of `target`, for `holdMs`. */
export function scaleNear(id: string, target: number, tolerance = 0.15, holdMs = 1000): Objective {
  return held(holdMs, ({ scene }) => {
    const o = find(scene, id);
    if (!o) return { ok: false };
    const ratio = o.scale / target;
    const off = Math.abs(ratio - 1);
    return {
      ok: off <= tolerance,
      partial: clamp01(1 - (off - tolerance) / 1),
      hint:
        ratio < 1
          ? 'Spread your hands to make it bigger'
          : 'Bring your hands together to shrink it',
    };
  });
}

export type Axis = 'x' | 'y' | 'z';
const AXIS: Record<Axis, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };

/**
 * Twist of a rotation about one axis, in radians (−π, π]: the part of the
 * rotation around that axis (swing–twist decomposition). Works for any axis,
 * so yaw and pitch objectives need no new math.
 */
export function twistAngle(q: Quat, axis: Axis): number {
  const a = AXIS[axis];
  const proj = q[0] * a[0] + q[1] * a[1] + q[2] * a[2];
  const angle = 2 * Math.atan2(proj, q[3]);
  // Normalize to (−π, π].
  return angle > Math.PI ? angle - 2 * Math.PI : angle <= -Math.PI ? angle + 2 * Math.PI : angle;
}

/** Rotation about `axis` within ±`toleranceDeg` of `targetDeg`, for `holdMs`. */
export function rotationNear(
  id: string,
  axis: Axis,
  targetDeg: number,
  toleranceDeg = 15,
  holdMs = 800,
): Objective {
  return held(holdMs, ({ scene }) => {
    const o = find(scene, id);
    if (!o) return { ok: false };
    const deg = (twistAngle(o.rotation, axis) * 180) / Math.PI;
    let off = deg - targetDeg;
    off = ((((off + 180) % 360) + 360) % 360) - 180;
    return {
      ok: Math.abs(off) <= toleranceDeg,
      partial: clamp01(1 - (Math.abs(off) - toleranceDeg) / 180),
      hint: off < 0 ? 'Turn it a bit more' : 'Turn it back a little',
    };
  });
}

/** World points of a stroke object. */
export function strokeWorldPoints(o: SceneObject): Vec3[] {
  const s = o.scale;
  // Strokes are drawn unrotated; scale and rotation from later grabs are rare in lessons
  // and the tolerance absorbs them, so only scale and position are applied here.
  return (o.points ?? []).map(([x, y, z]) => [
    o.position[0] + x * s,
    o.position[1] + y * s,
    o.position[2] + z * s,
  ]);
}

/** Fraction of guide points within `tolerance` of the stroke (0–1). */
export function guideCoverage(guide: Vec3[], stroke: Vec3[], tolerance: number): number {
  if (!guide.length || !stroke.length) return 0;
  let hit = 0;
  for (const g of guide) if (stroke.some((p) => dist(p, g) <= tolerance)) hit++;
  return hit / guide.length;
}

/**
 * Trace a guide: any single drawing added after the objective started covers
 * at least `minCoverage` of the guide's points within `tolerance`.
 */
export function traceGuide(guide: Vec3[], tolerance = 0.25, minCoverage = 0.7): Objective {
  let before: Set<string> | null = null;
  let best = 0;
  return {
    update({ scene }) {
      before ??= new Set(scene.objects.map((o) => o.id));
      for (const o of scene.objects) {
        if (o.kind !== 'stroke' || before.has(o.id)) continue;
        best = Math.max(best, guideCoverage(guide, strokeWorldPoints(o), tolerance));
      }
      const done = best >= minCoverage;
      return {
        progress: done ? 1 : best / minCoverage,
        done,
        ...(done
          ? {}
          : {
              hint: best > 0 ? 'Close — trace more of the line' : 'Pinch and trace the dotted line',
            }),
      };
    },
    reset() {
      before = null;
      best = 0;
    },
  };
}

/** A new object of `kind` appears (e.g. added from the menu). */
export function objectAdded(kind: ObjectKind): Objective {
  let before: Set<string> | null = null;
  let done = false;
  return {
    update({ scene }) {
      before ??= new Set(scene.objects.map((o) => o.id));
      done ||= scene.objects.some((o) => o.kind === kind && !before!.has(o.id));
      return { progress: done ? 1 : 0, done, ...(done ? {} : { hint: `Add a ${kind}` }) };
    },
    reset() {
      before = null;
      done = false;
    },
  };
}

/** The menu opens, then closes. */
export function menuOpenedAndClosed(): Objective {
  let opened = false;
  let done = false;
  return {
    update({ menuOpen }) {
      if (menuOpen) opened = true;
      else if (opened) done = true;
      return {
        progress: done ? 1 : opened ? 0.5 : 0,
        done,
        ...(done
          ? {}
          : { hint: opened ? 'Make a fist to close it' : 'Point and hold still to open the menu' }),
      };
    },
    reset() {
      opened = false;
      done = false;
    },
  };
}

/**
 * The object's distance from `from` (e.g. the camera) changes by at least
 * `delta` toward (+) or away (−), measured from where it was at the start.
 */
export function depthChange(id: string, from: Vec3, delta: number, holdMs = 300): Objective {
  let start: number | null = null;
  const timer = new HoldTimer(holdMs);
  return {
    update(ctx) {
      const o = find(ctx.scene, id);
      if (!o) return { progress: 0, done: false };
      const d = dist(o.position, from);
      start ??= d;
      const moved = start - d; // positive = closer
      const ok = delta > 0 ? moved >= delta : moved <= delta;
      const p = timer.update(ctx.t, ok);
      const done = p >= 1;
      return {
        progress: done ? 1 : ok ? 0.5 + p / 2 : clamp01(moved / delta) / 2,
        done,
        ...(done ? {} : { hint: delta > 0 ? 'Pull it toward you' : 'Push it away' }),
      };
    },
    reset() {
      start = null;
      timer.reset();
    },
  };
}

/** Objectives one after another; progress is the share done so far. */
export function sequence(steps: Objective[]): Objective {
  let i = 0;
  return {
    update(ctx) {
      let s: ObjectiveState = { progress: 1, done: true };
      while (i < steps.length) {
        s = steps[i]!.update(ctx);
        if (!s.done) break;
        i++;
      }
      const done = i >= steps.length;
      return {
        progress: done ? 1 : (i + s.progress) / steps.length,
        done,
        ...(done || !s.hint ? {} : { hint: s.hint }),
      };
    },
    reset() {
      i = 0;
      for (const s of steps) s.reset();
    },
  };
}
