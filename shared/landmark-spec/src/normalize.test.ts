import { describe, expect, it } from 'vitest';
import golden from '../golden/v0.json' with { type: 'json' };
import { mirrorRaw, syntheticOpenHand } from './fixtures.ts';
import { FEATURE_LENGTH, normalizeHand, SPEC_VERSION, type Handedness } from './normalize.ts';

const at = (v: ArrayLike<number>, i: number) => [v[i * 3]!, v[i * 3 + 1]!, v[i * 3 + 2]!];

function expectClose(a: ArrayLike<number>, b: ArrayLike<number>, tol = 1e-5) {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) expect(Math.abs(a[i]! - b[i]!)).toBeLessThanOrEqual(tol);
}

describe('normalizeHand: hand-computed case', () => {
  // Wrist at (0.5, 0.5), middle MCP 0.1 above it, index tip 0.05 right of the wrist.
  const raw = new Array(FEATURE_LENGTH).fill(0);
  for (let i = 0; i < 21; i++) {
    raw[i * 3] = 0.5;
    raw[i * 3 + 1] = 0.5;
  }
  raw[9 * 3 + 1] = 0.4; // middle MCP
  raw[8 * 3] = 0.55; // index tip x
  raw[8 * 3 + 2] = -0.02; // index tip z

  it('translates to the wrist and scales by palm size (aspect 1)', () => {
    const out = normalizeHand(raw, 'Right', 1)!;
    expect(at(out, 0)).toEqual([0, 0, 0]);
    expect(at(out, 9)[0]).toBeCloseTo(0);
    expect(at(out, 9)[1]).toBeCloseTo(-1);
    expect(at(out, 8)[0]).toBeCloseTo(0.5);
    expect(at(out, 8)[2]).toBeCloseTo(-0.2);
  });

  it('applies aspect to x and z before scaling', () => {
    const out = normalizeHand(raw, 'Right', 2)!;
    expect(at(out, 8)[0]).toBeCloseTo(1); // 0.05 * 2 / 0.1
    expect(at(out, 8)[2]).toBeCloseTo(-0.4);
  });

  it('mirrors left hands by negating x', () => {
    const out = normalizeHand(raw, 'Left', 1)!;
    expect(at(out, 8)[0]).toBeCloseTo(-0.5);
  });
});

describe('normalizeHand: invariances', () => {
  const hand = syntheticOpenHand(0.5, 0.7, 0.12);

  it('is invariant to where the hand is in the frame', () => {
    const moved = syntheticOpenHand(0.3, 0.45, 0.12);
    expectClose(normalizeHand(hand, 'Right', 16 / 9)!, normalizeHand(moved, 'Right', 16 / 9)!);
  });

  it('is invariant to hand size (distance from camera)', () => {
    const small = syntheticOpenHand(0.5, 0.7, 0.05);
    expectClose(
      normalizeHand(hand, 'Right', 16 / 9)!,
      normalizeHand(small, 'Right', 16 / 9)!,
      1e-4,
    );
  });

  it('maps a mirrored left hand onto the right hand', () => {
    const left = mirrorRaw(hand);
    expectClose(normalizeHand(left, 'Left', 16 / 9)!, normalizeHand(hand, 'Right', 16 / 9)!);
  });

  it('alignRotation points wrist→middle MCP straight up', () => {
    const tilted = hand.slice();
    // Rotate the raw hand ~30° around the wrist in aspect-corrected space.
    const a = 16 / 9;
    const [wx, wy] = [tilted[0]! * a, tilted[1]!];
    const t = Math.PI / 6;
    for (let i = 0; i < 21; i++) {
      const x = tilted[i * 3]! * a - wx;
      const y = tilted[i * 3 + 1]! - wy;
      tilted[i * 3] = (wx + x * Math.cos(t) - y * Math.sin(t)) / a;
      tilted[i * 3 + 1] = wy + x * Math.sin(t) + y * Math.cos(t);
    }
    const out = normalizeHand(tilted, 'Right', a, { alignRotation: true })!;
    expect(at(out, 9)[0]).toBeCloseTo(0, 5);
    expect(at(out, 9)[1]).toBeCloseTo(-1, 5);
    // ...and matches the untilted hand once aligned.
    expectClose(out, normalizeHand(hand, 'Right', a, { alignRotation: true })!, 1e-4);
  });
});

describe('normalizeHand: validation', () => {
  it('returns null for a degenerate hand', () => {
    expect(normalizeHand(new Array(FEATURE_LENGTH).fill(0.5), 'Right', 1)).toBeNull();
  });

  it('rejects wrong lengths and bad aspect', () => {
    expect(() => normalizeHand([1, 2, 3], 'Right', 1)).toThrow(/63/);
    expect(() => normalizeHand(syntheticOpenHand(), 'Right', 0)).toThrow(/aspect/);
  });
});

describe('golden vectors (cross-language parity)', () => {
  it('matches the spec version', () => {
    expect(golden.spec).toBe(SPEC_VERSION);
  });

  it.each(golden.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const out = normalizeHand(c.input, c.handedness as Handedness, c.aspect, c.options);
    expect(out).not.toBeNull();
    expectClose(out!, c.expected, golden.tolerance);
  });
});
