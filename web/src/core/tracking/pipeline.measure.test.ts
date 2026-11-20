import { describe, expect, it } from 'vitest';
import { cameraToScreen, interactionBox } from '@/core/interaction/handMapping';
import type { HandFrame } from '@/core/vision/types';
import { HandTracker } from './handTracker';
import { synthHand } from './synthetic';

/**
 * Cursor jitter and smoothing lag through tracker + mapping (the filter that
 * the smoothing setting controls), at 1440×900 with panels open, 30 Hz input.
 * Render-time easing adds a further ~12 ms time constant on top of this.
 * Numbers are printed so docs/benchmarks.md can quote them.
 */
const ASPECT = 16 / 9;
const RECT = { left: 0, top: 0, width: 1440 - 312, height: 900 };
const BOX = interactionBox(0.7, ASPECT, RECT.width / RECT.height);
const DT = 1000 / 30;

function noise(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
}

/** Landmark noise typical of MediaPipe on a still hand: ~0.002 of the frame. */
const NOISE = 0.002;

function run(
  smoothing: number,
  path: (t: number) => [number, number],
  ms: number,
  noiseAmp: number,
) {
  const tracker = new HandTracker({ smoothing });
  const rnd = noise(7);
  const out: Array<{
    t: number;
    truth: { x: number; y: number };
    cursor: { x: number; y: number };
  }> = [];
  for (let t = 0; t <= ms; t += DT) {
    const [cx, cy] = path(t);
    const hand = synthHand({ cx, cy });
    for (let i = 0; i < 63; i++) if (i % 3 !== 2) hand.image[i]! += noiseAmp * rnd();
    const frame: HandFrame = { timestamp: t, detectionMs: 0, hands: [hand] };
    const [track] = tracker.update(frame, ASPECT);
    const clean = new HandTracker({ smoothing: 0 });
    const [truthTrack] = clean.update({ ...frame, hands: [synthHand({ cx, cy })] }, ASPECT);
    out.push({
      t,
      cursor: cameraToScreen(track!.anchor, BOX, RECT),
      truth: cameraToScreen(truthTrack!.rawAnchor, BOX, RECT),
    });
  }
  return out;
}

const rms = (xs: number[]) => Math.sqrt(xs.reduce((a, b) => a + b * b, 0) / xs.length);

describe('pipeline measurements (1440×900, panels open, 30 Hz)', () => {
  it('stationary hand: cursor jitter', () => {
    const report: string[] = [];
    for (const s of [0, 0.5, 1]) {
      const samples = run(s, () => [0.5, 0.65], 4000, NOISE).slice(30);
      const mx = samples.reduce((a, b) => a + b.cursor.x, 0) / samples.length;
      const my = samples.reduce((a, b) => a + b.cursor.y, 0) / samples.length;
      const j = rms(samples.map((p) => Math.hypot(p.cursor.x - mx, p.cursor.y - my)));
      report.push(`smoothing ${s}: jitter RMS ${j.toFixed(2)} px`);
      if (s === 0.5) expect(j).toBeLessThan(2);
    }
    const raw = run(0, () => [0.5, 0.65], 4000, NOISE).slice(30);
    console.log('[measure] stationary, landmark noise ±0.002:', report.join(' | '));
    expect(raw.length).toBeGreaterThan(0);
  });

  it('moving hand: smoothing lag', () => {
    const report: string[] = [];
    for (const s of [0, 0.5, 1]) {
      // Hand sweeps 0.3 of the frame in 0.5 s (a deliberate drag), then holds.
      const path = (t: number): [number, number] => [0.35 + 0.3 * Math.min(1, t / 500), 0.65];
      const samples = run(s, path, 1500, 0);
      const moving = samples.filter((p) => p.t > 100 && p.t < 500);
      const lagPx =
        moving.reduce((a, p) => a + Math.abs(p.truth.x - p.cursor.x), 0) / moving.length;
      // Speed in px/ms during the sweep → lag expressed as time.
      const speed = Math.abs(samples.at(-1)!.truth.x - samples[0]!.truth.x) / 500;
      const lagMs = lagPx / speed;
      const settle = samples.find((p) => p.t >= 500 && Math.abs(p.truth.x - p.cursor.x) < 2);
      report.push(
        `smoothing ${s}: lag ${lagMs.toFixed(0)} ms (${lagPx.toFixed(1)} px), within 2 px ${settle ? (settle.t - 500).toFixed(0) : '>1000'} ms after stop`,
      );
      if (s === 0.5) expect(lagMs).toBeLessThanOrEqual(34);
    }
    console.log('[measure] sweep 0.3 frame / 500 ms:', report.join(' | '));
  });
});
