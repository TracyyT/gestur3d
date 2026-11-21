import { describe, expect, it } from 'vitest';
import type { PinchState } from '@/core/tracking/pinch';
import type { Pose } from './bimanual';
import type { Command, Vec3 } from './commands';
import {
  HandInteractionEngine,
  type EngineResult,
  type PointerInput,
  type SceneQuery,
} from './handInteraction';

/**
 * Flat test scene: screen px / 100 = world units on the z = 0 plane. Objects
 * are 100 px squares. Commands are applied to `poses`, like the real store.
 */
class World {
  poses = new Map<string, Pose>();
  constructor(objects: Record<string, Vec3>) {
    for (const [id, p] of Object.entries(objects))
      this.poses.set(id, { position: p, rotation: [0, 0, 0, 1], scale: 1 });
  }
  query(): SceneQuery {
    return {
      pick: ({ x, y }) => {
        for (const [id, { position: p, scale }] of this.poses) {
          const h = 0.5 * scale;
          if (Math.abs(x / 100 - p[0]) <= h && Math.abs(y / 100 - p[1]) <= h) return id;
        }
        return null;
      },
      planePoint: ({ x, y }) => [x / 100, y / 100, 0],
      objectPosition: (id) => this.poses.get(id)?.position ?? null,
      objectPose: (id) => this.poses.get(id) ?? null,
    };
  }
  apply(cmds: Command[]) {
    for (const c of cmds) {
      const o = this.poses.get('id' in c && c.id ? c.id : '');
      if (!o) continue;
      if (c.type === 'setPosition') o.position = c.position;
      if (c.type === 'setTransform') {
        if (c.position) o.position = c.position;
        if (c.rotation) o.rotation = c.rotation;
        if (c.scale !== undefined) o.scale = c.scale;
      }
    }
  }
  pos(id = 'a') {
    return this.poses.get(id)!.position;
  }
}

const pinch = (p: Partial<PinchState> = {}): PinchState => ({
  strength: 0,
  ratio: 1,
  active: false,
  started: false,
  ended: false,
  ...p,
});
const OPEN = pinch();
const START = pinch({ active: true, started: true, strength: 1 });
const HOLD = pinch({ active: true, strength: 1 });
const RELEASING = pinch({ active: true, strength: 0.5, releasing: true });
const END = pinch({ ended: true });

const hand = (
  id: number,
  x: number,
  y: number,
  p: PinchState,
  extra: Partial<PointerInput> = {},
): PointerInput => ({
  id,
  handedness: id === 1 ? 'Right' : 'Left',
  status: 'tracking',
  screen: { x, y },
  inBox: true,
  pinch: p,
  ...extra,
});
const lost = (id: number, x: number, y: number, p = HOLD) => hand(id, x, y, p, { status: 'lost' });

const never = () => false;
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Engine + world, stepping 33 ms per frame and applying commands. */
function rig(objects: Record<string, Vec3> = { a: [2, 2, 0] }) {
  const world = new World(objects);
  const engine = new HandInteractionEngine();
  let t = 0;
  const step = (...inputs: PointerInput[]): EngineResult => {
    t += 33;
    const r = engine.update(t, inputs, world.query(), never);
    world.apply(r.commands);
    return r;
  };
  /** One hand (id 1) grabs `a` at (190, 200); hand 2 joins at (230, 200). */
  const joinTwo = () => {
    step(hand(1, 190, 200, OPEN), hand(2, 400, 400, OPEN));
    step(hand(1, 190, 200, START), hand(2, 400, 400, OPEN));
    step(hand(1, 190, 200, HOLD), hand(2, 230, 200, OPEN));
    return step(hand(1, 190, 200, HOLD), hand(2, 230, 200, START));
  };
  return { world, engine, step, joinTwo, objects };
}

describe('two-hand grabs', () => {
  it('a second hand pinching the held object joins without moving it', () => {
    const { world, joinTwo } = rig();
    const before = [...world.pos()] as Vec3;
    const r = joinTwo();
    expect(r.twoHand).toHaveLength(1);
    expect(r.twoHand[0]!.pointerIds).toEqual([1, 2]);
    expect(r.pointers.map((p) => p.phase)).toEqual(['grabbing', 'grabbing']);
    expect(r.pointers.map((p) => p.grabbedId)).toEqual(['a', 'a']);
    expect(dist(world.pos(), before)).toBeLessThan(1e-9);
  });

  it('spreading the hands scales the object in place', () => {
    const { world, step, joinTwo } = rig();
    const before = [...world.pos()] as Vec3;
    joinTwo();
    let r!: EngineResult;
    for (let i = 0; i < 60; i++) r = step(hand(1, 150, 200, HOLD), hand(2, 270, 200, HOLD));
    expect(r.twoHand[0]!.mode).toBe('two');
    expect(world.poses.get('a')!.scale).toBeGreaterThan(2.5);
    // The midpoint (x = 2.1) didn't move, and scaling is about the object's center.
    expect(dist(world.pos(), before)).toBeLessThan(1e-9);
  });

  it('a second hand on a different object grabs that one on its own', () => {
    const { world, step } = rig({ a: [2, 2, 0], b: [5, 2, 0] });
    step(hand(1, 200, 200, OPEN), hand(2, 500, 200, OPEN));
    step(hand(1, 200, 200, START), hand(2, 500, 200, OPEN));
    const r = step(hand(1, 200, 200, HOLD), hand(2, 500, 200, START));
    expect(r.twoHand).toHaveLength(0);
    expect(r.held.get('a')).toBe(1);
    expect(r.held.get('b')).toBe(2);
    step(hand(1, 200, 300, HOLD), hand(2, 500, 100, HOLD));
    expect(world.pos('a')[1]).toBeCloseTo(3);
    expect(world.pos('b')[1]).toBeCloseTo(1);
  });

  it.each([
    ['second', 2, 1],
    ['first', 1, 2],
  ])('when the %s hand lets go, the other keeps it without a jump', (_, leaving, staying) => {
    const { world, step, joinTwo } = rig();
    joinTwo();
    for (let i = 0; i < 20; i++) step(hand(1, 160, 200, HOLD), hand(2, 260, 230, HOLD));
    const xs = { 1: 160, 2: 260 } as Record<number, number>;
    const ys = { 1: 200, 2: 230 } as Record<number, number>;
    const at = (id: number, p: PinchState, dx = 0) => hand(id, xs[id]! + dx, ys[id]!, p);
    const scale = world.poses.get('a')!.scale;
    const rotation = [...world.poses.get('a')!.rotation];
    const before = [...world.pos()] as Vec3;
    const r = step(...[at(leaving, END), at(staying, HOLD)].sort((p, q) => p.id - q.id));
    expect(r.twoHand).toHaveLength(0);
    expect(r.held.get('a')).toBe(staying);
    expect(dist(world.pos(), before)).toBeLessThan(1e-9);
    // Next frame, same place: still nothing moves.
    step(at(leaving, OPEN), at(staying, HOLD));
    expect(dist(world.pos(), before)).toBeLessThan(1e-9);
    // Then the remaining hand drags it 1 unit right; scale and rotation are kept.
    step(at(leaving, OPEN), at(staying, HOLD, 100));
    expect(world.pos()[0]).toBeCloseTo(before[0] + 1);
    expect(world.poses.get('a')!.scale).toBe(scale);
    expect(world.poses.get('a')!.rotation).toEqual(rotation);
  });

  it('both letting go in the same frame releases it in place', () => {
    const { world, step, joinTwo } = rig();
    joinTwo();
    step(hand(1, 180, 200, HOLD), hand(2, 240, 200, HOLD));
    const before = [...world.pos()] as Vec3;
    const r = step(hand(1, 180, 200, END), hand(2, 240, 200, END));
    expect(r.twoHand).toHaveLength(0);
    expect(r.held.size).toBe(0);
    expect(r.grabbing).toBe(false);
    expect(dist(world.pos(), before)).toBeLessThan(1e-9);
  });

  it('holds everything still while either hand is opening its fingers', () => {
    const { world, step, joinTwo } = rig();
    joinTwo();
    const before = { ...world.poses.get('a')! };
    const r = step(hand(1, 120, 260, HOLD), hand(2, 300, 140, RELEASING));
    expect(r.commands).toHaveLength(0);
    expect(world.poses.get('a')!.scale).toBe(before.scale);
    // A false alarm (pinch closes again): resumes from where it is, no jump.
    const pos = [...world.pos()] as Vec3;
    step(hand(1, 120, 260, HOLD), hand(2, 300, 140, HOLD));
    expect(dist(world.pos(), pos)).toBeLessThan(1e-9);
  });

  it('one hand lost: the other keeps moving it, scale holds, and the return does not jump', () => {
    const { world, step, joinTwo } = rig();
    joinTwo();
    for (let i = 0; i < 20; i++) step(hand(1, 160, 200, HOLD), hand(2, 260, 200, HOLD));
    const scale = world.poses.get('a')!.scale;
    let r = step(hand(1, 160, 200, HOLD), lost(2, 260, 200));
    expect(r.twoHand[0]!.mode).toBe('one');
    expect(r.twoHand[0]!.lostId).toBe(2);
    expect(r.pointers.find((p) => p.id === 2)!.phase).toBe('lost');
    const p0 = [...world.pos()] as Vec3;
    step(hand(1, 160, 300, HOLD), lost(2, 260, 200));
    expect(world.pos()[1]).toBeCloseTo(p0[1] + 1);
    expect(world.poses.get('a')!.scale).toBe(scale);
    // Hand 2 comes back somewhere else, still pinched.
    const p1 = [...world.pos()] as Vec3;
    r = step(hand(1, 160, 300, HOLD), hand(2, 330, 380, HOLD));
    expect(r.twoHand[0]!.mode).toBe('two');
    expect(dist(world.pos(), p1)).toBeLessThan(1e-9);
    expect(world.poses.get('a')!.scale).toBeCloseTo(scale, 9);
  });

  it('a lost hand that expires leaves the grab; the other keeps it', () => {
    const { world, step, joinTwo } = rig();
    joinTwo();
    step(hand(1, 190, 200, HOLD), lost(2, 230, 200));
    const before = [...world.pos()] as Vec3;
    const r = step(hand(1, 190, 200, HOLD)); // track 2 expired
    expect(r.twoHand).toHaveLength(0);
    expect(r.held.get('a')).toBe(1);
    expect(dist(world.pos(), before)).toBeLessThan(1e-9);
    step(hand(1, 290, 200, HOLD));
    expect(world.pos()[0]).toBeCloseTo(before[0] + 1);
  });

  it('a lost hand that opened while lost leaves the grab when it returns', () => {
    const { step, joinTwo } = rig();
    joinTwo();
    step(hand(1, 190, 200, HOLD), lost(2, 230, 200));
    const r = step(hand(1, 190, 200, HOLD), hand(2, 230, 200, OPEN));
    expect(r.twoHand).toHaveLength(0);
    expect(r.held.get('a')).toBe(1);
  });

  it('both hands lost: the object freezes, then either hand can carry on', () => {
    const { world, step, joinTwo } = rig();
    joinTwo();
    const before = [...world.pos()] as Vec3;
    const r = step(lost(1, 400, 400), lost(2, 500, 500));
    expect(r.twoHand[0]!.mode).toBe('frozen');
    expect(r.commands).toHaveLength(0);
    expect(r.grabbing).toBe(true);
    step(hand(1, 190, 200, HOLD), lost(2, 500, 500));
    expect(dist(world.pos(), before)).toBeLessThan(1e-9);
    step(hand(1, 190, 300, HOLD), lost(2, 500, 500));
    expect(world.pos()[1]).toBeCloseTo(before[1] + 1);
  });

  it('joins by pinching on empty space, so small objects need no room for both hands', () => {
    const { world, step } = rig();
    step(hand(1, 200, 200, OPEN), hand(2, 600, 500, OPEN));
    step(hand(1, 200, 200, START), hand(2, 600, 500, OPEN));
    const before = [...world.pos()] as Vec3;
    const r = step(hand(1, 200, 200, HOLD), hand(2, 600, 500, START));
    expect(r.twoHand).toHaveLength(1);
    expect(dist(world.pos(), before)).toBeLessThan(1e-9);
  });

  it('pinching empty space with nothing held by the other hand does nothing', () => {
    const { step } = rig();
    step(hand(1, 600, 600, OPEN), hand(2, 700, 500, OPEN));
    const r = step(hand(1, 600, 600, HOLD), hand(2, 700, 500, START));
    expect(r.twoHand).toHaveLength(0);
    expect(r.held.size).toBe(0);
    expect(r.pointers.find((p) => p.id === 2)!.phase).toBe('pinching');
  });

  it('a hand outside the interaction box does not join', () => {
    const { step } = rig();
    step(hand(1, 200, 200, OPEN), hand(2, 600, 500, OPEN));
    step(hand(1, 200, 200, START), hand(2, 600, 500, OPEN));
    const r = step(hand(1, 200, 200, HOLD), hand(2, 600, 500, START, { inBox: false }));
    expect(r.twoHand).toHaveLength(0);
  });

  it('a hand that appears already pinched over a held object does not join', () => {
    const { step } = rig();
    step(hand(1, 190, 200, OPEN));
    step(hand(1, 190, 200, START));
    step(hand(1, 190, 200, HOLD), hand(2, 230, 200, HOLD));
    const r = step(hand(1, 190, 200, HOLD), hand(2, 230, 200, START));
    expect(r.twoHand).toHaveLength(0);
  });

  it('cannot join an object the mouse is dragging', () => {
    const world = new World({ a: [2, 2, 0] });
    const engine = new HandInteractionEngine();
    engine.update(0, [hand(1, 200, 200, OPEN), hand(2, 220, 200, OPEN)], world.query(), never);
    engine.update(33, [hand(1, 200, 200, START), hand(2, 220, 200, OPEN)], world.query(), never);
    const r = engine.update(
      66,
      [hand(1, 200, 200, HOLD), hand(2, 220, 200, START)],
      world.query(),
      (id) => id === 'a',
    );
    expect(r.twoHand).toHaveLength(0);
  });

  it('hands that come together hold scale, and spreading again resumes without a jump', () => {
    const { world, step, joinTwo } = rig();
    joinTwo();
    step(hand(1, 198, 200, HOLD), hand(2, 222, 200, HOLD));
    let r = step(hand(1, 205, 200, HOLD), hand(2, 215, 200, HOLD));
    expect(r.twoHand[0]!.holding).toBe(true);
    const scale = world.poses.get('a')!.scale;
    const pos = [...world.pos()] as Vec3;
    r = step(hand(1, 160, 200, HOLD), hand(2, 260, 200, HOLD));
    expect(r.twoHand[0]!.holding).toBe(false);
    expect(world.poses.get('a')!.scale).toBeCloseTo(scale, 9);
    expect(dist(world.pos(), pos)).toBeLessThan(1e-9);
  });
});
