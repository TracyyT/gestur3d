import { describe, expect, it } from 'vitest';
import type { HandFrame, TrackedHand } from '@/core/vision/types';
import { anchorPoint, HandTracker, maxPlausibleMove } from './handTracker';
import { OneEuroFilter, smoothingToParams } from './oneEuro';
import { PinchDetector, pinchRatio, sensitivityToThresholds } from './pinch';
import { synthHand } from './synthetic';

const frame = (t: number, ...hands: TrackedHand[]): HandFrame => ({
  timestamp: t,
  detectionMs: 8,
  hands,
});

/** Deterministic pseudo-random noise in [-1, 1]. */
function noise(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
}

describe('OneEuroFilter', () => {
  it('passes the first sample through and holds a constant signal', () => {
    const f = new OneEuroFilter(smoothingToParams(0.5));
    expect(f.filter(0.4, 0)).toBe(0.4);
    for (let i = 1; i < 30; i++) expect(f.filter(0.4, i * 33)).toBeCloseTo(0.4);
  });

  it('cuts jitter on a stationary hand by a large factor', () => {
    const f = new OneEuroFilter(smoothingToParams(0.5));
    const rnd = noise(3);
    const amp = 0.003; // ~2 px at 720p
    const out: number[] = [];
    for (let i = 0; i < 300; i++) out.push(f.filter(0.5 + amp * rnd(), i * 33.3));
    const tail = out.slice(60);
    const mean = tail.reduce((a, b) => a + b, 0) / tail.length;
    const rms = Math.sqrt(tail.reduce((a, b) => a + (b - mean) ** 2, 0) / tail.length);
    expect(rms).toBeLessThan(amp * 0.35);
  });

  it('follows a fast move with little lag', () => {
    const f = new OneEuroFilter(smoothingToParams(0.5));
    // Hand moves 0.3 of the frame in 200 ms (a quick reach) at 30 Hz.
    let t = 0;
    for (let i = 0; i < 10; i++) f.filter(0.2, (t += 33.3));
    let out = 0;
    for (let i = 1; i <= 6; i++) out = f.filter(0.2 + (0.3 * i) / 6, (t += 33.3));
    // At the end of the move the filtered value is within ~2 frames of motion.
    expect(0.5 - out).toBeLessThan(0.1);
    // One more frame at rest and it has nearly caught up.
    out = f.filter(0.5, t + 33.3);
    expect(0.5 - out).toBeLessThan(0.05);
  });

  it('more smoothing means steadier output', () => {
    const run = (s: number) => {
      const f = new OneEuroFilter(smoothingToParams(s));
      const rnd = noise(9);
      const out: number[] = [];
      for (let i = 0; i < 200; i++) out.push(f.filter(0.5 + 0.003 * rnd(), i * 33.3));
      return Math.max(...out.slice(50)) - Math.min(...out.slice(50));
    };
    expect(run(0.9)).toBeLessThan(run(0.1));
  });
});

describe('pinch', () => {
  it('ratio is large for an open hand and small when pinched', () => {
    const open = synthHand({ cx: 0.5, cy: 0.7 });
    const closed = synthHand({ cx: 0.5, cy: 0.7, pinch: 1 });
    expect(pinchRatio(open.world, open.image)).toBeGreaterThan(1);
    expect(pinchRatio(closed.world, closed.image)).toBeLessThan(0.1);
  });

  it('image fallback agrees with world landmarks', () => {
    const h = synthHand({ cx: 0.4, cy: 0.6, pinch: 0.5 });
    expect(pinchRatio(new Float32Array(0), h.image)).toBeCloseTo(pinchRatio(h.world, h.image), 2);
  });

  it('is independent of distance from the camera', () => {
    const near = synthHand({ cx: 0.5, cy: 0.7, size: 0.2, pinch: 0.6 });
    const far = synthHand({ cx: 0.5, cy: 0.7, size: 0.06, pinch: 0.6 });
    expect(pinchRatio(new Float32Array(0), near.image)).toBeCloseTo(
      pinchRatio(new Float32Array(0), far.image),
      3,
    );
  });

  it('detector needs a short hold, and uses hysteresis', () => {
    const th = sensitivityToThresholds(0.5);
    const d = new PinchDetector(th);
    const closed = th.enter - 0.1;
    expect(d.update(closed, 0).active).toBe(false);
    const s = d.update(closed, th.minHoldMs);
    expect(s.active && s.started).toBe(true);
    // A loosened grip between enter and exit stays pinched (no flicker).
    for (let t = 100; t < 400; t += 33)
      expect(d.update((th.enter + th.exit) / 2, t).active).toBe(true);
  });

  it('a single open spike while holding does not drop the pinch', () => {
    const th = sensitivityToThresholds(0.5);
    const d = new PinchDetector(th);
    d.update(0.2, 0);
    d.update(0.2, 60);
    expect(d.update(1.5, 93).active).toBe(true); // one noisy frame
    expect(d.update(0.2, 126).active).toBe(true);
    expect(d.update(0.2, 159).active).toBe(true);
  });

  it('releases once the fingers stay open past exit, flagging "releasing" meanwhile', () => {
    const th = sensitivityToThresholds(0.5);
    const d = new PinchDetector(th);
    d.update(0.2, 0);
    d.update(0.2, 60);
    let t = 60;
    let sawReleasing = false;
    let ended = false;
    for (let i = 0; i < 10 && !ended; i++) {
      const st = d.update(1.2, (t += 33));
      sawReleasing ||= !!st.releasing && st.active;
      ended = st.ended;
    }
    expect(sawReleasing).toBe(true);
    expect(ended).toBe(true);
    expect(t - 60).toBeLessThanOrEqual(200);
  });

  it('real-hand pinch ratios (~0.35–0.42) start a grab at default sensitivity', () => {
    const th = sensitivityToThresholds(0.5);
    const d = new PinchDetector(th);
    d.update(0.4, 0);
    expect(d.update(0.38, 60).active).toBe(true);
    expect(d.update(0.38, 93).strength).toBe(1);
  });

  it('a single closed frame does not trigger', () => {
    const th = sensitivityToThresholds(0.5);
    const d = new PinchDetector(th);
    d.update(0.1, 0);
    expect(d.update(1.0, 33).active).toBe(false);
    expect(d.update(0.1, 66).active).toBe(false);
  });

  it('higher sensitivity starts pinches earlier', () => {
    expect(sensitivityToThresholds(0.9).enter).toBeGreaterThan(sensitivityToThresholds(0.1).enter);
  });
});

describe('anchorPoint', () => {
  it('knuckle anchor barely moves while pinching; pinch anchor moves', () => {
    const open = synthHand({ cx: 0.5, cy: 0.7 });
    const closed = synthHand({ cx: 0.5, cy: 0.7, pinch: 1 });
    const move = (m: 'pinch' | 'knuckle' | 'blend') => {
      const a = anchorPoint(open.image, m);
      const b = anchorPoint(closed.image, m);
      return Math.hypot(a[0] - b[0], a[1] - b[1]);
    };
    expect(move('knuckle')).toBeLessThan(1e-6);
    expect(move('pinch')).toBeGreaterThan(move('blend'));
  });
});

describe('HandTracker', () => {
  const A = 16 / 9;

  it('keeps one id for a moving hand', () => {
    const tr = new HandTracker();
    const a = tr.update(frame(0, synthHand({ cx: 0.5, cy: 0.7 })), A);
    const b = tr.update(frame(33, synthHand({ cx: 0.52, cy: 0.69 })), A);
    expect(a[0]!.id).toBe(b[0]!.id);
  });

  it('tracks two hands separately', () => {
    const tr = new HandTracker();
    const s = tr.update(
      frame(
        0,
        synthHand({ cx: 0.3, cy: 0.7, handedness: 'Right' }),
        synthHand({ cx: 0.7, cy: 0.7, handedness: 'Left' }),
      ),
      A,
    );
    expect(new Set(s.map((t) => t.id)).size).toBe(2);
  });

  it('marks a missing hand lost, re-acquires it within the grace period, drops it after', () => {
    const tr = new HandTracker({ lostGraceMs: 300 });
    const [first] = tr.update(frame(0, synthHand({ cx: 0.5, cy: 0.7 })), A);
    const lost = tr.update(frame(33), A);
    expect(lost[0]!.status).toBe('lost');
    const back = tr.update(frame(200, synthHand({ cx: 0.51, cy: 0.7 })), A);
    expect(back[0]!.id).toBe(first!.id);
    expect(back[0]!.status).toBe('tracking');

    tr.update(frame(233), A);
    expect(tr.expire(500)).toHaveLength(1);
    expect(tr.expire(600)).toHaveLength(0);
  });

  it('a hand gone longer than the grace period is not re-matched, even without expire()', () => {
    const tr = new HandTracker({ lostGraceMs: 300 });
    const [first] = tr.update(frame(0, synthHand({ cx: 0.5, cy: 0.7 })), A);
    tr.update(frame(33), A);
    const back = tr.update(frame(600, synthHand({ cx: 0.5, cy: 0.7 })), A);
    expect(back).toHaveLength(1);
    expect(back[0]!.id).not.toBe(first!.id);
  });

  it('treats an implausible jump as a different hand', () => {
    const tr = new HandTracker();
    const [a] = tr.update(frame(0, synthHand({ cx: 0.2, cy: 0.7 })), A);
    const s = tr.update(frame(33, synthHand({ cx: 0.85, cy: 0.7 })), A);
    const current = s.find((t) => t.status === 'tracking')!;
    expect(current.id).not.toBe(a!.id);
  });

  it('never matches across handedness', () => {
    const tr = new HandTracker();
    const [a] = tr.update(frame(0, synthHand({ cx: 0.5, cy: 0.7, handedness: 'Right' })), A);
    const s = tr.update(frame(33, synthHand({ cx: 0.5, cy: 0.7, handedness: 'Left' })), A);
    expect(s.find((t) => t.status === 'tracking')!.id).not.toBe(a!.id);
  });

  it('reports pinch start and end through the track', () => {
    const tr = new HandTracker();
    let t = 0;
    tr.update(frame(t, synthHand({ cx: 0.5, cy: 0.7 })), A);
    let started = false;
    for (let i = 0; i < 4; i++) {
      const [s] = tr.update(frame((t += 33), synthHand({ cx: 0.5, cy: 0.7, pinch: 1 })), A);
      started ||= s!.pinch.started;
    }
    expect(started).toBe(true);
    let ended = false;
    for (let i = 0; i < 8 && !ended; i++) {
      const [after] = tr.update(frame((t += 33), synthHand({ cx: 0.5, cy: 0.7 })), A);
      ended = after!.pinch.ended;
    }
    expect(ended).toBe(true);
  });

  it('plausible-move budget grows with time between frames', () => {
    expect(maxPlausibleMove(100)).toBeGreaterThan(maxPlausibleMove(33));
    expect(maxPlausibleMove(10_000)).toBe(0.35);
  });
});
