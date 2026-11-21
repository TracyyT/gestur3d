import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { quatAngleBetween, quatFromAxisAngle, quatRotateVec3, type Quat } from '@/core/math/quat';
import {
  BimanualGrip,
  DEFAULT_BIMANUAL_OPTIONS,
  softClampLog,
  softDeadZone,
  softUnclampLog,
  type BimanualOptions,
  type Pose,
  type ViewBasis,
} from './bimanual';
import type { Vec3 } from './commands';

// Camera looking down −Z: right = +X, up = +Y, toward the viewer = +Z.
const VIEW: ViewBasis = { right: [1, 0, 0], up: [0, 1, 0] };
const START: Pose = { position: [0, 0.25, 0], rotation: [0, 0, 0, 1], scale: 1 };
/** Filters and dead zones off: output follows input exactly. */
const EXACT: Partial<BimanualOptions> = {
  scaleDeadZone: 0,
  rollDeadZone: 0,
  scaleFilter: { minCutoff: 1e9, beta: 0, dCutoff: 1 },
  rollFilter: { minCutoff: 1e9, beta: 0, dCutoff: 1 },
};

const L: Vec3 = [-1, 0, 0];
const R: Vec3 = [1, 0, 0];

const closeVec = (a: readonly number[], b: readonly number[], digits = 6) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, digits));

/** Hands at angle θ (screen CCW) and half-separation h around center c. */
function hands(c: Vec3, h: number, theta: number): [Vec3, Vec3] {
  const dx = Math.cos(theta) * h;
  const dy = Math.sin(theta) * h;
  return [
    [c[0] - dx, c[1] - dy, c[2]],
    [c[0] + dx, c[1] + dy, c[2]],
  ];
}

describe('BimanualGrip', () => {
  it('returns the starting pose exactly when the hands have not moved', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0);
    const r = g.update(L, R, 33);
    expect(r.position).toEqual(START.position);
    expect(r.rotation).toEqual(START.rotation);
    expect(r.scale).toBe(1);
  });

  it('translates with the midpoint', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0, EXACT);
    const r = g.update([-0.5, 1, 0.2], [1.5, 1, 0.2], 33);
    closeVec(r.position, [0.5, 1.25, 0.2]);
    expect(r.scale).toBeCloseTo(1);
    expect(quatAngleBetween(r.rotation, START.rotation)).toBeCloseTo(0);
  });

  it('scales with hand separation, in place', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0, EXACT);
    const r = g.update([-2, 0, 0], [2, 0, 0], 33);
    expect(r.scale).toBeCloseTo(2);
    closeVec(r.position, START.position);
  });

  it('with the hands as pivot, scaling moves the object away from the midpoint', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0, { ...EXACT, pivot: 'hands' });
    const r = g.update([-2, 0, 0], [2, 0, 0], 33);
    expect(r.scale).toBeCloseTo(2);
    closeVec(r.position, [0, 0.5, 0]);
  });

  it('rolls with the hand line, counter-clockwise on screen', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0, EXACT);
    const [a, b] = hands([0, 0, 0], 1, Math.PI / 2);
    const r = g.update(a, b, 33);
    expect(r.roll).toBeCloseTo(Math.PI / 2);
    expect(quatAngleBetween(r.rotation, quatFromAxisAngle([0, 0, 1], Math.PI / 2))).toBeCloseTo(0);
    // Turns about its own center: it stays put.
    closeVec(r.position, START.position);
  });

  it('held from far to one side, turning does not swing the object around the hands', () => {
    const far: Vec3[] = [
      [-6, 0, 0],
      [-4, 0, 0],
    ];
    const g = new BimanualGrip(START, far[0]!, far[1]!, VIEW, 0, EXACT);
    const [a, b] = hands([-5, 0, 0], 1, Math.PI / 2);
    closeVec(g.update(a, b, 33).position, START.position);
  });

  it('with the hands as pivot, keeps both grip points attached to the object', () => {
    const start: Pose = {
      position: [0.3, -0.2, 0.1],
      rotation: quatFromAxisAngle([1, 1, 0], 0.6),
      scale: 1.2,
    };
    const g = new BimanualGrip(start, L, R, VIEW, 0, { ...EXACT, pivot: 'hands' });
    // Where the grips sit in the object's own frame at the start.
    const local = (p: Vec3) =>
      quatRotateVec3(
        [-start.rotation[0], -start.rotation[1], -start.rotation[2], start.rotation[3]] as Quat,
        [
          (p[0] - start.position[0]) / start.scale,
          (p[1] - start.position[1]) / start.scale,
          (p[2] - start.position[2]) / start.scale,
        ],
      );
    const la = local(L);
    const lb = local(R);
    const [a, b] = hands([0.4, 0.6, 0], 1.4, 0.8);
    const r = g.update(a, b, 33);
    const world = (l: Vec3) => {
      const v = quatRotateVec3(r.rotation, l);
      return [
        r.position[0] + v[0] * r.scale,
        r.position[1] + v[1] * r.scale,
        r.position[2] + v[2] * r.scale,
      ];
    };
    closeVec(world(la), a, 5);
    closeVec(world(lb), b, 5);
  });

  it('unwraps the angle so turning past 180° keeps going', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0, EXACT);
    let r = g.result;
    for (let i = 1; i <= 54; i++) {
      const [a, b] = hands([0, 0, 0], 1, (i * 5 * Math.PI) / 180);
      r = g.update(a, b, i * 33);
    }
    expect(r.roll).toBeCloseTo((270 * Math.PI) / 180);
  });

  it('ignores small scale and roll changes, without a step at the edge', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0, {
      ...EXACT,
      scaleDeadZone: DEFAULT_BIMANUAL_OPTIONS.scaleDeadZone,
      rollDeadZone: DEFAULT_BIMANUAL_OPTIONS.rollDeadZone,
    });
    const [a, b] = hands([0, 0, 0], 1.02, (1 * Math.PI) / 180);
    const r = g.update(a, b, 33);
    expect(r.scale).toBe(1);
    expect(r.roll).toBe(0);
    expect(softDeadZone(0.0301, 0.03)).toBeCloseTo(0.0001);
    expect(softDeadZone(-0.0301, 0.03)).toBeCloseTo(-0.0001);
  });

  it('smooths scale and roll but settles on the target', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0);
    const [a, b] = hands([0, 0, 0], 1.6, 0.5);
    const first = g.update(a, b, 33);
    expect(first.scale).toBeLessThan(1.6);
    let r = first;
    for (let t = 66; t < 2000; t += 33) r = g.update(a, b, t);
    // Dead zones shift the target slightly.
    expect(r.scale).toBeCloseTo(1.6 * Math.exp(-DEFAULT_BIMANUAL_OPTIONS.scaleDeadZone), 3);
    expect(r.roll).toBeCloseTo(0.5 - DEFAULT_BIMANUAL_OPTIONS.rollDeadZone, 3);
  });

  it('eases into the scale limit and flags it', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0, EXACT);
    let r = g.update([-2.5, 0, 0], [2.5, 0, 0], 33);
    expect(r.scale).toBeGreaterThan(2.4);
    expect(r.scale).toBeLessThan(2.5);
    expect(r.atLimit).toBe(false);
    r = g.update([-5, 0, 0], [5, 0, 0], 66);
    expect(r.scale).toBeCloseTo(3, 9);
    expect(r.atLimit).toBe(true);
    r = g.update([-0.1, 0, 0], [0.1, 0, 0], 99);
    expect(r.scale).toBeGreaterThanOrEqual(DEFAULT_BIMANUAL_OPTIONS.scaleMin);
  });

  it('does not jump when the snapshot is taken at a scale limit', () => {
    const atMax: Pose = { ...START, scale: 3 };
    const g = new BimanualGrip(atMax, L, R, VIEW, 0, EXACT);
    expect(g.update(L, R, 33).scale).toBeCloseTo(3, 9);
    // Shrinking from the limit moves smoothly away from it.
    const r = g.update([-0.8, 0, 0], [0.8, 0, 0], 66);
    expect(r.scale).toBeLessThan(3);
    expect(r.scale).toBeGreaterThan(2.3);
  });

  it('holds scale and roll while the hands are too close, then resumes without a jump', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0, EXACT);
    g.update([-0.5, 0, 0], [0.5, 0, 0], 33);
    const before = g.update([-0.1, 0, 0], [0.1, 0, 0], 66);
    expect(before.holding).toBe(true);
    // Twisting and translating while close: only translation follows.
    const held = g.update([0.4, 0.1, 0], [0.5, 0, 0], 99);
    expect(held.scale).toBeCloseTo(before.scale);
    expect(quatAngleBetween(held.rotation, before.rotation)).toBeCloseTo(0);
    // Spreading again: the first frame out matches the last held pose.
    const out = g.update([0, 0, 0], [0.9, 0, 0], 132);
    expect(out.holding).toBe(false);
    closeVec(out.position, g.update([0, 0, 0], [0.9, 0, 0], 165).position);
  });

  it('does not flip when the hands cross', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0, EXACT);
    let r = g.result;
    for (let i = 0; i <= 40; i++) {
      const x = 1 - i * 0.05; // right hand moves left past the left hand and back out
      r = g.update([-x, 0, 0], [x, 0, 0], 33 + i * 33);
    }
    expect(quatAngleBetween(r.rotation, START.rotation)).toBeLessThan(0.01);
  });

  it('measures scale and roll from the span points when given, translation from the grips', () => {
    const spanA: Vec3 = [-0.5, 0, 0];
    const spanB: Vec3 = [0.5, 0, 0];
    const g = new BimanualGrip(START, L, R, VIEW, 0, EXACT, [spanA, spanB]);
    // Grips (knuckles) stay 2 apart; fingertips spread from 1 to 2 apart.
    const r = g.update([-1, 0.5, 0], [1, 0.5, 0], 33, [
      [-1, 0.5, 0],
      [1, 0.5, 0],
    ]);
    expect(r.scale).toBeCloseTo(2);
    closeVec(r.position, [0, 0.75, 0]);
  });

  it('fingertips coming together hold scale instead of collapsing it', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0, EXACT, [
      [-0.5, 0, 0],
      [0.5, 0, 0],
    ]);
    const r = g.update(L, R, 33, [
      [-0.05, 0, 0],
      [0.05, 0, 0],
    ]);
    expect(r.holding).toBe(true);
    expect(r.scale).toBe(1);
  });

  it('depth is off by default: bigger palms do not move the object', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0, EXACT, undefined, [0.1, 0.1]);
    const r = g.update(L, R, 33, undefined, [0.15, 0.15]);
    closeVec(r.position, START.position);
    expect(r.depth).toBe(0);
  });

  it('with depth on, hands toward the camera bring the object forward', () => {
    const opts = {
      ...EXACT,
      depthGain: 3,
      depthDeadZone: 0.04,
      depthFilter: { minCutoff: 1e9, beta: 0, dCutoff: 1 },
    };
    const g = new BimanualGrip(START, L, R, VIEW, 0, opts, undefined, [0.1, 0.1]);
    expect(g.update(L, R, 33, undefined, [0.1, 0.1]).position).toEqual(START.position);
    // Palms 25% bigger: ln(1.25) − 0.04 dead zone, times the gain, toward +Z (the viewer).
    const r = g.update(L, R, 66, undefined, [0.125, 0.125]);
    const want = 3 * (Math.log(1.25) - 0.04);
    expect(r.depth).toBeCloseTo(want);
    closeVec(r.position, [0, 0.25, want]);
    // Small changes inside the dead zone do nothing.
    const g2 = new BimanualGrip(START, L, R, VIEW, 0, opts, undefined, [0.1, 0.1]);
    expect(g2.update(L, R, 33, undefined, [0.103, 0.103]).depth).toBe(0);
  });

  it('rebase keeps the current pose', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0, EXACT);
    const moved = g.update(...hands([0.5, 0.5, 0], 1.5, 0.7), 33);
    g.rebase(moved, [0, 0, 0], [0.8, 0.3, 0], 50);
    const r = g.update([0, 0, 0], [0.8, 0.3, 0], 83);
    closeVec(r.position, moved.position);
    expect(r.scale).toBeCloseTo(moved.scale);
    expect(quatAngleBetween(r.rotation, moved.rotation)).toBeCloseTo(0);
  });
});

describe('soft scale limits', () => {
  const lo = Math.log(0.3);
  const hi = Math.log(3);
  const band = Math.log(1.15);

  it('is the identity well inside the range', () => {
    expect(softClampLog(0, lo, hi, band)).toBe(0);
  });

  it('never leaves the range and is non-decreasing', () => {
    let prev = -Infinity;
    for (let x = lo - 2; x <= hi + 2; x += 0.001) {
      const y = softClampLog(x, lo, hi, band);
      expect(y).toBeGreaterThanOrEqual(lo - 1e-12);
      expect(y).toBeLessThanOrEqual(hi + 1e-12);
      expect(y).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = y;
    }
  });

  it('round-trips through its inverse', () => {
    for (let y = lo + 1e-6; y < hi; y += 0.01) {
      expect(softClampLog(softUnclampLog(y, lo, hi, band), lo, hi, band)).toBeCloseTo(y, 9);
    }
  });
});

describe('BimanualGrip properties', () => {
  const coord = fc.double({ min: -3, max: 3, noNaN: true });
  const point = fc.tuple(coord, coord, fc.double({ min: -0.5, max: 0.5, noNaN: true }));

  it('stays finite and inside the scale limits for any hand path, and rebase never jumps', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(point, point, fc.boolean(), fc.double({ min: 0.05, max: 0.3, noNaN: true })),
          { minLength: 1, maxLength: 60 },
        ),
        (steps) => {
          const g = new BimanualGrip(
            START,
            L,
            R,
            VIEW,
            0,
            { depthGain: 3 },
            undefined,
            [0.12, 0.12],
          );
          let t = 0;
          for (const [a, b, rebase, palm] of steps) {
            const palms = [palm, palm * 1.1] as const;
            t += 33;
            if (rebase) {
              const before = g.result;
              g.rebase(before, a, b, t, undefined, palms);
              t += 33;
              const after = g.update(a, b, t, undefined, palms);
              for (let i = 0; i < 3; i++)
                expect(Math.abs(after.position[i]! - before.position[i]!)).toBeLessThan(1e-6);
              expect(Math.abs(after.scale - before.scale)).toBeLessThan(1e-9);
              expect(quatAngleBetween(after.rotation, before.rotation)).toBeLessThan(1e-6);
            }
            const r = g.update(a, b, t, undefined, palms);
            expect(r.position.every(Number.isFinite)).toBe(true);
            expect(r.rotation.every(Number.isFinite)).toBe(true);
            expect(r.scale).toBeGreaterThanOrEqual(DEFAULT_BIMANUAL_OPTIONS.scaleMin - 1e-9);
            expect(r.scale).toBeLessThanOrEqual(DEFAULT_BIMANUAL_OPTIONS.scaleMax + 1e-9);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('BimanualGrip cost', () => {
  it('updates in well under 0.1 ms on average', () => {
    const g = new BimanualGrip(START, L, R, VIEW, 0);
    const n = 10_000;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      const [a, b] = hands([Math.sin(i * 0.01), 0, 0], 1 + 0.3 * Math.sin(i * 0.02), i * 0.003);
      g.update(a, b, i * 33);
    }
    const avg = (performance.now() - t0) / n;
    expect(avg).toBeLessThan(0.1);
  });
});
