import { describe, expect, it } from 'vitest';
import { synthHand } from '@/core/tracking/synthetic';
import { HandLandmark as L } from '@/core/vision/types';
import { OpenPalmDetector } from './openPalmDetector';
import { isOpenPalm } from './rules/openPalm';

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

/** Curl a finger: move its tip and DIP back toward the MCP. */
function curl(w: Float32Array, mcp: number, joints: number[]) {
  const out = Float32Array.from(w);
  for (const j of joints) {
    for (let k = 0; k < 2; k++)
      out[j * 3 + k] = w[mcp * 3 + k]! + (w[j * 3 + k]! - w[mcp * 3 + k]!) * 0.2;
  }
  return out;
}

describe('isOpenPalm', () => {
  it('accepts a spread open hand facing the camera', () => {
    expect(isOpenPalm(palm())).toBe(true);
  });

  it('rejects a relaxed open hand (fingers not spread), like one aiming at an object', () => {
    expect(isOpenPalm(palm({ fanDeg: 0 }))).toBe(false);
  });

  it('accepts a slightly turned palm, rejects one turned side-on', () => {
    expect(isOpenPalm(turned(palm(), 25))).toBe(true);
    expect(isOpenPalm(turned(palm(), 50))).toBe(false);
    expect(isOpenPalm(turned(palm(), -50))).toBe(false);
  });

  it('accepts the back of the hand too (left/right labels are unreliable)', () => {
    expect(isOpenPalm(turned(palm(), 180))).toBe(true);
  });

  it('rejects a pinch, a curled finger, and a tucked thumb', () => {
    expect(isOpenPalm(palm({ pinch: 1 }))).toBe(false);
    expect(isOpenPalm(curl(palm(), L.RingMcp, [L.RingPip, L.RingDip, L.RingTip]))).toBe(false);
    const tucked = palm();
    tucked.set(tucked.subarray(L.IndexMcp * 3, L.IndexMcp * 3 + 3), L.ThumbTip * 3);
    expect(isOpenPalm(tucked)).toBe(false);
  });

  it('accepts synthetic hands with spread fingers (either hand) and not relaxed ones', () => {
    for (const handedness of ['Right', 'Left'] as const) {
      expect(isOpenPalm(synthHand({ cx: 0.5, cy: 0.6, handedness, spread: 45 }).world)).toBe(true);
      expect(isOpenPalm(synthHand({ cx: 0.5, cy: 0.6, handedness }).world)).toBe(false);
    }
  });

  it('rejects degenerate input', () => {
    expect(isOpenPalm(new Float32Array(63))).toBe(false);
  });
});

describe('OpenPalmDetector', () => {
  const still = (_t: number, allowed = true) => ({
    world: palm(),
    center: [0.5, 0.5] as const,
    allowed,
  });

  it('completes once after the pose is held still for 600 ms', () => {
    const d = new OpenPalmDetector();
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
    const d = new OpenPalmDetector();
    for (let t = 0; t <= 1500; t += 33) {
      const r = d.update(t, { world: palm(), center: [0.3 + t / 3000, 0.5], allowed: true });
      expect(r.completed).toBe(false);
    }
  });

  it('does not open while not allowed (holding something)', () => {
    const d = new OpenPalmDetector();
    for (let t = 0; t <= 1500; t += 33) expect(d.update(t, still(t, false)).completed).toBe(false);
  });

  it('tolerates a one-frame miss but resets after a real break', () => {
    const d = new OpenPalmDetector();
    let opened = false;
    for (let t = 0; t <= 900; t += 33) {
      const miss = t === 297; // one frame without the hand
      const r = d.update(t, miss ? null : still(t));
      opened ||= r.completed;
    }
    expect(opened).toBe(true);

    const d2 = new OpenPalmDetector();
    let progress = 0;
    for (let t = 0; t <= 500; t += 33) progress = d2.update(t, still(t)).progress;
    expect(progress).toBeGreaterThan(0.7);
    for (let t = 533; t <= 800; t += 33) d2.update(t, { ...still(t), world: palm({ fanDeg: 0 }) });
    expect(d2.update(833, still(833)).progress).toBe(0);
  });
});
