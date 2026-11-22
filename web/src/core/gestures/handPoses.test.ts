import { describe, expect, it } from 'vitest';
import { synthHand } from '@/core/tracking/synthetic';
import { HandLandmark as L } from '@/core/vision/types';
import { PoseHoldDetector } from './poseHoldDetector';
import { isFist, isOpenHand, isPointing } from './rules/handPoses';

/** World landmarks of the synthetic hand, with fingers fanned out by `fanDeg`. */
function palm({ fanDeg = 30, pinch = 0 } = {}) {
  const w = Float32Array.from(synthHand({ cx: 0.5, cy: 0.6, pinch }).world);
  const fan = (mcp: number, joints: number[], deg: number) => {
    const a = (deg * Math.PI) / 180;
    const cx = w[mcp * 3]!;
    const cy = w[mcp * 3 + 1]!;
    for (const j of joints) {
      const x = w[j * 3]! - cx;
      const y = w[j * 3 + 1]! - cy;
      w[j * 3] = cx + x * Math.cos(a) - y * Math.sin(a);
      w[j * 3 + 1] = cy + x * Math.sin(a) + y * Math.cos(a);
    }
  };
  // Index leans toward the thumb side (+x), pinky away (−x).
  fan(L.IndexMcp, [L.IndexPip, L.IndexDip, L.IndexTip], fanDeg / 2);
  fan(L.PinkyMcp, [L.PinkyPip, L.PinkyDip, L.PinkyTip], -fanDeg / 2);
  return w;
}

/** Turn the whole hand about the vertical axis (palm turning sideways). */
function turned(w: Float32Array, deg: number) {
  const a = (deg * Math.PI) / 180;
  const out = Float32Array.from(w);
  for (let i = 0; i < 21; i++) {
    const x = w[i * 3]!;
    const z = w[i * 3 + 2]!;
    out[i * 3] = x * Math.cos(a) + z * Math.sin(a);
    out[i * 3 + 2] = -x * Math.sin(a) + z * Math.cos(a);
  }
  return out;
}

/** Curl a finger: fold its DIP and tip back down toward the wrist, past the PIP. */
function curl(w: Float32Array, mcp: number, joints: number[]) {
  const out = Float32Array.from(w);
  const [, dip, tip] = joints;
  for (const [j, k] of [
    [dip!, 0.15],
    [tip!, 0.35],
  ] as const) {
    for (let c = 0; c < 3; c++)
      out[j * 3 + c] = w[mcp * 3 + c]! + (w[L.Wrist * 3 + c]! - w[mcp * 3 + c]!) * k;
  }
  return out;
}

describe('isPointing', () => {
  it('accepts a synthetic pointing hand, either hand, however it is turned', () => {
    for (const handedness of ['Right', 'Left'] as const) {
      const w = Float32Array.from(synthHand({ cx: 0.5, cy: 0.6, handedness, point: true }).world);
      expect(isPointing(w)).toBe(true);
      expect(isPointing(turned(w, 70))).toBe(true);
      expect(isPointing(turned(w, 180))).toBe(true);
    }
  });

  it('rejects an open hand, a fist, a pinch and degenerate input', () => {
    expect(isPointing(synthHand({ cx: 0.5, cy: 0.6 }).world)).toBe(false);
    const fist = curl(
      Float32Array.from(synthHand({ cx: 0.5, cy: 0.6, point: true }).world),
      L.IndexMcp,
      [L.IndexPip, L.IndexDip, L.IndexTip],
    );
    expect(isPointing(fist)).toBe(false);
    expect(isPointing(synthHand({ cx: 0.5, cy: 0.6, point: true, pinch: 1 }).world)).toBe(false);
    expect(isPointing(new Float32Array(63))).toBe(false);
  });

  it('rejects two fingers up (index and middle)', () => {
    const open = synthHand({ cx: 0.5, cy: 0.6 }).world;
    const w = Float32Array.from(synthHand({ cx: 0.5, cy: 0.6, point: true }).world);
    for (const j of [L.MiddlePip, L.MiddleDip, L.MiddleTip])
      w.set(open.slice(j * 3, j * 3 + 3), j * 3);
    expect(isPointing(w)).toBe(false);
  });
});

describe('PoseHoldDetector (pointing)', () => {
  const pointing = synthHand({ cx: 0.5, cy: 0.6, point: true }).world;
  const still = (_t: number, allowed = true) => ({
    world: pointing,
    center: [0.5, 0.5] as const,
    allowed,
  });

  it('completes once after the pose is held still for 600 ms', () => {
    const d = new PoseHoldDetector(isPointing);
    let completed = 0;
    let last = d.update(0, still(0));
    for (let t = 33; t <= 1500; t += 33) {
      last = d.update(t, still(t));
      if (last.completed) {
        completed++;
        expect(t).toBeGreaterThanOrEqual(600);
        expect(t).toBeLessThan(700);
      }
    }
    expect(completed).toBe(1);
    expect(last.progress).toBe(1);
  });

  it('does not open while the hand is moving', () => {
    const d = new PoseHoldDetector(isPointing);
    for (let t = 0; t <= 1500; t += 33) {
      const r = d.update(t, { world: pointing, center: [0.3 + t / 3000, 0.5], allowed: true });
      expect(r.completed).toBe(false);
    }
  });

  it('does not open while not allowed (holding something)', () => {
    const d = new PoseHoldDetector(isPointing);
    for (let t = 0; t <= 1500; t += 33) expect(d.update(t, still(t, false)).completed).toBe(false);
  });

  it('tolerates a one-frame miss but resets after a real break', () => {
    const d = new PoseHoldDetector(isPointing);
    let opened = false;
    for (let t = 0; t <= 900; t += 33) {
      const miss = t === 297; // one frame without the hand
      const r = d.update(t, miss ? null : still(t));
      opened ||= r.completed;
    }
    expect(opened).toBe(true);

    const d2 = new PoseHoldDetector(isPointing);
    let progress = 0;
    for (let t = 0; t <= 500; t += 33) progress = d2.update(t, still(t)).progress;
    expect(progress).toBeGreaterThan(0.7);
    for (let t = 533; t <= 800; t += 33)
      d2.update(t, { ...still(t), world: synthHand({ cx: 0.5, cy: 0.6 }).world });
    expect(d2.update(833, still(833)).progress).toBe(0);
  });
});

describe('isOpenHand', () => {
  it('accepts a plain open hand (no spread needed), facing either way', () => {
    expect(isOpenHand(synthHand({ cx: 0.5, cy: 0.6 }).world)).toBe(true);
    expect(isOpenHand(turned(palm({ fanDeg: 0 }), 180))).toBe(true);
    expect(isOpenHand(turned(palm({ fanDeg: 0 }), 40))).toBe(true);
  });

  it('rejects a pinch, a curled finger, a side-on hand and degenerate input', () => {
    expect(isOpenHand(synthHand({ cx: 0.5, cy: 0.6, pinch: 1 }).world)).toBe(false);
    expect(isOpenHand(curl(palm(), L.MiddleMcp, [L.MiddlePip, L.MiddleDip, L.MiddleTip]))).toBe(
      false,
    );
    expect(isOpenHand(turned(palm(), 65))).toBe(false);
    expect(isOpenHand(new Float32Array(63))).toBe(false);
  });
});

describe('isFist', () => {
  it('is true only when all four fingers are curled', () => {
    let w = palm();
    expect(isFist(w)).toBe(false);
    for (const [mcp, j] of [
      [L.IndexMcp, [L.IndexPip, L.IndexDip, L.IndexTip]],
      [L.MiddleMcp, [L.MiddlePip, L.MiddleDip, L.MiddleTip]],
      [L.RingMcp, [L.RingPip, L.RingDip, L.RingTip]],
    ] as const) {
      w = curl(w, mcp, [...j]);
      expect(isFist(w)).toBe(false);
    }
    w = curl(w, L.PinkyMcp, [L.PinkyPip, L.PinkyDip, L.PinkyTip]);
    expect(isFist(w)).toBe(true);
  });
});
