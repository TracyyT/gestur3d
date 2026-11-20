import { describe, expect, it } from 'vitest';
import type { PinchState } from '@/core/tracking/pinch';
import type { Vec3 } from './commands';
import { HandInteractionEngine, type PointerInput, type SceneQuery } from './handInteraction';

/**
 * A flat test scene: screen px map 1:1 to world units /100 on the z = 0 plane.
 * Objects are 100 px squares centered on their positions.
 */
function scene(objects: Record<string, Vec3>): SceneQuery {
  return {
    pick: ({ x, y }) => {
      for (const [id, p] of Object.entries(objects)) {
        if (Math.abs(x / 100 - p[0]) <= 0.5 && Math.abs(y / 100 - p[1]) <= 0.5) return id;
      }
      return null;
    },
    planePoint: ({ x, y }) => [x / 100, y / 100, 0],
    objectPosition: (id) => objects[id] ?? null,
  };
}

const pinch = (p: Partial<PinchState> = {}): PinchState => ({
  strength: 0,
  active: false,
  started: false,
  ended: false,
  ...p,
});
const OPEN = pinch();
const START = pinch({ active: true, started: true, strength: 1 });
const HOLD = pinch({ active: true, strength: 1 });
const END = pinch({ ended: true });

const hand = (
  x: number,
  y: number,
  p: PinchState,
  extra: Partial<PointerInput> = {},
): PointerInput => ({
  id: 1,
  handedness: 'Right',
  status: 'tracking',
  screen: { x, y },
  inBox: true,
  pinch: p,
  ...extra,
});

const never = () => false;

describe('HandInteractionEngine', () => {
  it('hovers the object under the cursor', () => {
    const e = new HandInteractionEngine();
    const r = e.update(0, [hand(205, 100, OPEN)], scene({ a: [2, 1, 0] }), never);
    expect(r.pointers[0]!.phase).toBe('hovering');
    expect(r.pointers[0]!.hoverId).toBe('a');
  });

  it('grabs on pinch start, moves with the hand keeping the offset, releases on pinch end', () => {
    const e = new HandInteractionEngine();
    const s = scene({ a: [2, 1, 0] });
    e.update(0, [hand(220, 100, OPEN)], s, never);
    const g = e.update(33, [hand(220, 100, START)], s, never);
    expect(g.pointers[0]!.phase).toBe('grabbing');
    expect(g.commands).toContainEqual({ type: 'select', id: 'a' });
    expect(g.held.get('a')).toBe(1);

    const m = e.update(66, [hand(320, 150, HOLD)], s, never);
    const move = m.commands.find((c) => c.type === 'setPosition');
    // Grabbed 0.2 right of center → object center stays 0.2 left of the cursor.
    expect(move).toMatchObject({ id: 'a' });
    if (move?.type === 'setPosition') {
      expect(move.position[0]).toBeCloseTo(3.0);
      expect(move.position[1]).toBeCloseTo(1.5);
    }

    const r = e.update(99, [hand(320, 150, END)], s, never);
    expect(r.pointers[0]!.grabbedId).toBeNull();
    expect(r.pointers[0]!.releasedAt).toBe(99);
    expect(r.held.size).toBe(0);
  });

  it('does not snap the object to the cursor at grab start', () => {
    const e = new HandInteractionEngine();
    const s = scene({ a: [2, 1, 0] });
    e.update(0, [hand(240, 120, OPEN)], s, never);
    const g = e.update(33, [hand(240, 120, START)], s, never);
    expect(g.commands.some((c) => c.type === 'setPosition')).toBe(false);
    const still = e.update(66, [hand(240, 120, HOLD)], s, never);
    expect(still.commands).toHaveLength(0);
  });

  it('a closed pinch swept across an object never grabs it', () => {
    const e = new HandInteractionEngine();
    const s = scene({ a: [2, 1, 0] });
    e.update(0, [hand(0, 0, START)], s, never); // pinch over empty space
    const swept = e.update(33, [hand(200, 100, HOLD)], s, never);
    expect(swept.pointers[0]!.phase).toBe('pinching');
    expect(swept.held.size).toBe(0);
    // Open, then pinch again over the object: now it grabs.
    e.update(66, [hand(200, 100, END)], s, never);
    const g = e.update(99, [hand(200, 100, START)], s, never);
    expect(g.pointers[0]!.phase).toBe('grabbing');
  });

  it('a hand that appears already pinched must open first', () => {
    const e = new HandInteractionEngine();
    const r = e.update(0, [hand(200, 100, HOLD)], scene({ a: [2, 1, 0] }), never);
    expect(r.pointers[0]!.phase).toBe('pinching');
    expect(r.held.size).toBe(0);
  });

  it('freezes a held object while tracking is lost, then continues', () => {
    const e = new HandInteractionEngine();
    const s = scene({ a: [2, 1, 0] });
    e.update(0, [hand(200, 100, OPEN)], s, never);
    e.update(33, [hand(200, 100, START)], s, never);
    const lost = e.update(66, [hand(900, 900, HOLD, { status: 'lost' })], s, never);
    expect(lost.commands).toHaveLength(0);
    expect(lost.pointers[0]!.phase).toBe('lost');
    expect(lost.held.get('a')).toBe(1);
    const back = e.update(200, [hand(250, 100, HOLD)], s, never);
    expect(back.commands.find((c) => c.type === 'setPosition')).toBeDefined();
  });

  it('releases in place when the track expires', () => {
    const e = new HandInteractionEngine();
    const s = scene({ a: [2, 1, 0] });
    e.update(0, [hand(200, 100, OPEN)], s, never);
    e.update(33, [hand(200, 100, START)], s, never);
    const gone = e.update(400, [], s, never);
    expect(gone.held.size).toBe(0);
    expect(gone.commands).toHaveLength(0);
  });

  it('one hand per object, and mouse-held objects are off limits', () => {
    const e = new HandInteractionEngine();
    const s = scene({ a: [2, 1, 0] });
    const left = (p: PinchState) => hand(200, 100, p, { id: 2, handedness: 'Left' });
    e.update(0, [hand(200, 100, OPEN), left(OPEN)], s, never);
    e.update(33, [hand(200, 100, START), left(OPEN)], s, never);
    const r = e.update(66, [hand(200, 100, HOLD), left(START)], s, never);
    expect(r.held.get('a')).toBe(1);
    expect(r.pointers.find((p) => p.id === 2)!.phase).toBe('pinching');

    const e2 = new HandInteractionEngine();
    e2.update(0, [hand(200, 100, OPEN)], s, never);
    const blocked = e2.update(33, [hand(200, 100, START)], s, (id) => id === 'a');
    expect(blocked.held.size).toBe(0);
  });

  it('ignores objects when the hand is outside the interaction box', () => {
    const e = new HandInteractionEngine();
    const r = e.update(0, [hand(200, 100, OPEN, { inBox: false })], scene({ a: [2, 1, 0] }), never);
    expect(r.pointers[0]!.hoverId).toBeNull();
  });
});
