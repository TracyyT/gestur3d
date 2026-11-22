import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { SceneModel, SceneObject, Vec3 } from '@/core/interaction/commands';
import { quatFromAxisAngle, quatMultiply } from '@/core/math/quat';
import {
  depthChange,
  guideCoverage,
  handsInView,
  HoldTimer,
  hoverEach,
  menuOpenedAndClosed,
  objectAdded,
  objectInZone,
  type Objective,
  type ObjectiveContext,
  type HandSnapshot,
  rotationNear,
  scaleNear,
  sequence,
  traceGuide,
  twistAngle,
} from './objectives';

const obj = (o: Partial<SceneObject> & { id: string }): SceneObject => ({
  kind: 'cube',
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],
  scale: 1,
  ...o,
});
const scene = (...objects: SceneObject[]): SceneModel => ({
  objects,
  selectedId: null,
  nextId: objects.length + 1,
});
const hand = (h: Partial<HandSnapshot> = {}): HandSnapshot => ({
  id: 0,
  inView: true,
  hoverId: null,
  grabbedId: null,
  ...h,
});

/** Run an objective for `ms` at 30 Hz with a context that may change over time. */
function run(o: Objective, ms: number, at: (t: number) => Omit<ObjectiveContext, 't'>, t0 = 0) {
  let s = o.update({ t: t0, ...at(t0) });
  for (let t = t0 + 33; t <= t0 + ms; t += 33) s = o.update({ t, ...at(t) });
  return s;
}
const ctx = (s: SceneModel, hands: HandSnapshot[] = [], menuOpen = false) => ({
  scene: s,
  hands,
  menuOpen,
});

describe('HoldTimer', () => {
  it('finishes after the hold time and stays finished', () => {
    const h = new HoldTimer(500);
    let p = 0;
    for (let t = 0; t <= 520; t += 20) p = h.update(t, true);
    expect(p).toBe(1);
    expect(h.update(600, false)).toBe(1);
  });

  it('a short miss pauses the hold; a long one resets it', () => {
    const h = new HoldTimer(1000, 200);
    for (let t = 0; t <= 600; t += 20) h.update(t, true);
    for (let t = 620; t <= 720; t += 20) h.update(t, false); // 100 ms miss
    expect(h.update(740, true)).toBeGreaterThan(0.55);
    for (let t = 760; t <= 1100; t += 20) h.update(t, false); // 340 ms miss
    expect(h.update(1120, true)).toBe(0);
  });

  it('is never above 1 or below 0 whatever the input', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { maxLength: 200 }), (oks) => {
        const h = new HoldTimer(300);
        return oks.every((ok, i) => {
          const p = h.update(i * 16, ok);
          return p >= 0 && p <= 1;
        });
      }),
    );
  });
});

describe('objectives', () => {
  it('handsInView needs the count for the hold, with hints', () => {
    const two = handsInView(2, 1000);
    expect(run(two, 1500, () => ctx(scene(), [hand()]))).toMatchObject({
      done: false,
      hint: 'Now the other hand too',
    });
    expect(run(two, 1100, () => ctx(scene(), [hand(), hand({ id: 1 })]), 2000).done).toBe(true);
  });

  it('handsInView ignores hands outside the reach box', () => {
    const one = handsInView(1, 500);
    expect(run(one, 1000, () => ctx(scene(), [hand({ inView: false })])).done).toBe(false);
  });

  it('hoverEach visits targets in order', () => {
    const o = hoverEach(['a', 'b'], 300);
    // Hovering b first does nothing.
    expect(run(o, 500, () => ctx(scene(), [hand({ hoverId: 'b' })])).progress).toBe(0);
    expect(run(o, 400, () => ctx(scene(), [hand({ hoverId: 'a' })]), 1000).progress).toBe(0.5);
    expect(run(o, 400, () => ctx(scene(), [hand({ hoverId: 'b' })]), 2000).done).toBe(true);
  });

  it('objectInZone wants the object inside and let go', () => {
    const o = objectInZone('a', [1, 0, 0], 0.5, { holdMs: 300 });
    const inside = scene(obj({ id: 'a', position: [1.2, 0, 0] }));
    const held = run(o, 600, () => ctx(inside, [hand({ grabbedId: 'a' })]));
    expect(held).toMatchObject({ done: false, hint: 'Now let go' });
    expect(run(o, 400, () => ctx(inside, [hand()]), 1000).done).toBe(true);
  });

  it('objectInZone shows partial progress as the object nears the zone', () => {
    const o = objectInZone('a', [0, 0, 0], 0.5);
    const far = o.update({ t: 0, ...ctx(scene(obj({ id: 'a', position: [3, 0, 0] }))) }).progress;
    const near = o.update({ t: 33, ...ctx(scene(obj({ id: 'a', position: [1, 0, 0] }))) }).progress;
    expect(near).toBeGreaterThan(far);
    expect(near).toBeLessThan(0.5);
  });

  it('scaleNear accepts ±15% and says which way to go', () => {
    const o = scaleNear('a', 2, 0.15, 500);
    expect(run(o, 600, () => ctx(scene(obj({ id: 'a', scale: 1 })))).hint).toMatch(/bigger/);
    expect(run(o, 600, () => ctx(scene(obj({ id: 'a', scale: 2.25 }))), 1000).done).toBe(true);
  });

  it('twistAngle recovers the angle about each axis, even with other rotation mixed in', () => {
    for (const axis of ['x', 'y', 'z'] as const) {
      const v: Vec3 = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
      for (const deg of [-150, -40, 0, 30, 90, 170]) {
        const q = quatFromAxisAngle(v, (deg * Math.PI) / 180);
        expect((twistAngle(q, axis) * 180) / Math.PI).toBeCloseTo(deg, 6);
      }
    }
    // A pure rotation about x has no twist about z.
    expect(twistAngle(quatFromAxisAngle([1, 0, 0], 1), 'z')).toBeCloseTo(0, 9);
    // Roll of 45° plus a small tilt still reads about 45° of roll.
    const q = quatMultiply(
      quatFromAxisAngle([0, 0, 1], Math.PI / 4),
      quatFromAxisAngle([1, 0, 0], 0.15),
    );
    expect((twistAngle(q, 'z') * 180) / Math.PI).toBeCloseTo(45, 0);
  });

  it('rotationNear works on any axis and wraps around ±180°', () => {
    const at = (axis: Vec3, deg: number) =>
      scene(obj({ id: 'a', rotation: quatFromAxisAngle(axis, (deg * Math.PI) / 180) }));
    expect(run(rotationNear('a', 'z', 90), 1000, () => ctx(at([0, 0, 1], 80))).done).toBe(true);
    expect(run(rotationNear('a', 'z', 90), 1000, () => ctx(at([0, 0, 1], 60))).done).toBe(false);
    expect(run(rotationNear('a', 'y', 45), 1000, () => ctx(at([0, 1, 0], 50))).done).toBe(true);
    expect(run(rotationNear('a', 'z', 175), 1000, () => ctx(at([0, 0, 1], -178))).done).toBe(true);
  });

  it('traceGuide counts only drawings made after it started', () => {
    const guide: Vec3[] = Array.from({ length: 11 }, (_, i) => [i / 10, 0, 0]);
    const old = obj({ id: 'old', kind: 'stroke', points: guide.map(([x]) => [x, 0, 0]) });
    const o = traceGuide(guide, 0.1, 0.7);
    expect(o.update({ t: 0, ...ctx(scene(old)) }).done).toBe(false);
    const half = obj({
      id: 'n1',
      kind: 'stroke',
      position: [0.25, 0.05, 0],
      points: Array.from({ length: 6 }, (_, i) => [i / 10 - 0.25, 0, 0] as Vec3),
    });
    const s1 = o.update({ t: 33, ...ctx(scene(old, half)) });
    expect(s1.done).toBe(false);
    expect(s1.progress).toBeGreaterThan(0.6);
    const full = obj({ id: 'n2', kind: 'stroke', points: guide.map(([x]) => [x, 0.05, 0]) });
    expect(o.update({ t: 66, ...ctx(scene(old, half, full)) }).done).toBe(true);
  });

  it('guideCoverage is 0 for empty input and 1 for an exact trace', () => {
    const g: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
    ];
    expect(guideCoverage(g, [], 0.1)).toBe(0);
    expect(guideCoverage(g, g, 0.01)).toBe(1);
  });

  it('objectAdded waits for a new object of the kind', () => {
    const o = objectAdded('sphere');
    expect(o.update({ t: 0, ...ctx(scene(obj({ id: 'a', kind: 'sphere' }))) }).done).toBe(false);
    const s = scene(obj({ id: 'a', kind: 'sphere' }), obj({ id: 'b', kind: 'sphere' }));
    expect(o.update({ t: 33, ...ctx(s) }).done).toBe(true);
  });

  it('menuOpenedAndClosed needs both, in order', () => {
    const o = menuOpenedAndClosed();
    expect(o.update({ t: 0, ...ctx(scene()) }).progress).toBe(0);
    expect(o.update({ t: 33, ...ctx(scene(), [], true) })).toMatchObject({ progress: 0.5 });
    expect(o.update({ t: 66, ...ctx(scene()) }).done).toBe(true);
  });

  it('depthChange measures from where the object started', () => {
    const camera: Vec3 = [0, 0, 10];
    const o = depthChange('a', camera, 1, 200);
    o.update({ t: 0, ...ctx(scene(obj({ id: 'a', position: [0, 0, 2] }))) });
    expect(run(o, 300, () => ctx(scene(obj({ id: 'a', position: [0, 0, 2.5] }))), 33).done).toBe(
      false,
    );
    expect(run(o, 300, () => ctx(scene(obj({ id: 'a', position: [0, 0, 3.2] }))), 400).done).toBe(
      true,
    );
    const away = depthChange('a', camera, -1, 200);
    away.update({ t: 0, ...ctx(scene(obj({ id: 'a', position: [0, 0, 2] }))) });
    expect(run(away, 300, () => ctx(scene(obj({ id: 'a', position: [0, 0, 0.8] }))), 33).done).toBe(
      true,
    );
  });

  it('sequence runs steps in order and reports overall progress', () => {
    const o = sequence([handsInView(1, 200), objectAdded('ring')]);
    const s1 = run(o, 300, () => ctx(scene(), [hand()]));
    expect(s1).toMatchObject({ done: false, progress: 0.5, hint: 'Add a ring' });
    expect(o.update({ t: 400, ...ctx(scene(obj({ id: 'r', kind: 'ring' })), [hand()]) }).done).toBe(
      true,
    );
    o.reset();
    expect(o.update({ t: 500, ...ctx(scene()) }).progress).toBe(0);
  });
});
