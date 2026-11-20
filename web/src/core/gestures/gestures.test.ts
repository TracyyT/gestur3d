import { describe, expect, it } from 'vitest';
import { HoldTracker } from './holdTracker';
import { isThumbsUp } from './rules/thumbsUp';

type P = [number, number];

/** Build a 63-value landmark array from 21 (x, y) points, z = 0. */
const hand = (pts: P[]) => {
  const out = new Float32Array(63);
  pts.forEach(([x, y], i) => {
    out[i * 3] = x;
    out[i * 3 + 1] = y;
  });
  return out;
};

// Sideways fist with the thumb pointing up (aspect 1, y down).
const THUMBS_UP: P[] = [
  [0.5, 0.6], // wrist
  [0.47, 0.55],
  [0.45, 0.5],
  [0.44, 0.44],
  [0.44, 0.38], // thumb CMC, MCP, IP, TIP
  [0.5, 0.5],
  [0.56, 0.5],
  [0.55, 0.54],
  [0.52, 0.54], // index, curled
  [0.5, 0.54],
  [0.57, 0.54],
  [0.56, 0.58],
  [0.53, 0.58], // middle, curled
  [0.5, 0.57],
  [0.56, 0.57],
  [0.555, 0.6],
  [0.53, 0.6], // ring, curled
  [0.51, 0.62],
  [0.55, 0.62],
  [0.545, 0.645],
  [0.525, 0.64], // pinky, curled
];

const withPoints = (base: P[], changes: Record<number, P>) => base.map((p, i) => changes[i] ?? p);
const mirrorX = (pts: P[]): P[] => pts.map(([x, y]) => [1 - x, y]);
const flipY = (pts: P[]): P[] => pts.map(([x, y]) => [x, 1.2 - y]);

describe('isThumbsUp', () => {
  it('detects a thumbs-up', () => {
    expect(isThumbsUp(hand(THUMBS_UP), 1)).toBe(true);
  });

  it('works for either hand', () => {
    expect(isThumbsUp(hand(mirrorX(THUMBS_UP)), 1)).toBe(true);
  });

  it('rejects a thumbs-down', () => {
    expect(isThumbsUp(hand(flipY(THUMBS_UP)), 1)).toBe(false);
  });

  it('rejects a fist with the thumb tucked in', () => {
    const fist = withPoints(THUMBS_UP, { 3: [0.5, 0.5], 4: [0.53, 0.52] });
    expect(isThumbsUp(hand(fist), 1)).toBe(false);
  });

  it('rejects an open hand', () => {
    const open = withPoints(THUMBS_UP, {
      6: [0.5, 0.4],
      7: [0.5, 0.34],
      8: [0.5, 0.29],
      10: [0.53, 0.4],
      11: [0.53, 0.33],
      12: [0.53, 0.27],
    });
    expect(isThumbsUp(hand(open), 1)).toBe(false);
  });

  it('rejects pointing up (index extended)', () => {
    const point = withPoints(THUMBS_UP, { 6: [0.5, 0.42], 7: [0.5, 0.36], 8: [0.5, 0.3] });
    expect(isThumbsUp(hand(point), 1)).toBe(false);
  });

  it('rejects a thumb pointing sideways', () => {
    const side = withPoints(THUMBS_UP, { 3: [0.38, 0.49], 4: [0.32, 0.48] });
    expect(isThumbsUp(hand(side), 1)).toBe(false);
  });

  it('handles a degenerate hand', () => {
    expect(isThumbsUp(new Float32Array(63), 1)).toBe(false);
  });
});

describe('HoldTracker', () => {
  it('completes once after the hold duration', () => {
    const h = new HoldTracker(1000, 200);
    expect(h.update(0, true).progress).toBe(0);
    expect(h.update(500, true).progress).toBeCloseTo(0.5);
    const done = h.update(1000, true);
    expect(done).toEqual({ progress: 1, completed: true });
    expect(h.update(1100, true).completed).toBe(false); // no repeat-fire while held
  });

  it('tolerates brief dropouts but resets after the grace period', () => {
    const h = new HoldTracker(1000, 200);
    h.update(0, true);
    h.update(400, false); // 400 ms gap is longer than the grace period → reset
    expect(h.update(450, true).progress).toBe(0);

    const g = new HoldTracker(1000, 200);
    g.update(0, true);
    g.update(300, true);
    g.update(400, false); // 100 ms gap, within grace
    expect(g.update(500, true).progress).toBeCloseTo(0.5);
  });

  it('can fire again after the gesture is released', () => {
    const h = new HoldTracker(100, 50);
    h.update(0, true);
    expect(h.update(100, true).completed).toBe(true);
    h.update(200, false);
    h.update(300, true);
    expect(h.update(400, true).completed).toBe(true);
  });
});
