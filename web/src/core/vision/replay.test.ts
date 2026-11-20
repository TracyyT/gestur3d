import { describe, expect, it } from 'vitest';
import { scriptedRecording } from '@/core/tracking/scripts';
import { synthHand } from '@/core/tracking/synthetic';
import { isRecording, toHandFrame, toRecordedFrame } from './recording';
import { LandmarkRecorder, ReplayHandSource } from './replaySource';
import type { HandFrame, HandSource } from './types';

/** Manual clock + scheduler so replay timing is deterministic. */
function fakeTime() {
  let now = 0;
  let queued: (() => void) | null = null;
  return {
    now: () => now,
    schedule: (cb: () => void) => {
      queued = cb;
      return 1;
    },
    cancel: () => {
      queued = null;
    },
    advance(ms: number) {
      now += ms;
      const cb = queued;
      queued = null;
      cb?.();
    },
  };
}

describe('recording format', () => {
  it('round-trips a frame', () => {
    const hand = synthHand({ cx: 0.4, cy: 0.6, pinch: 0.3 });
    const rec = toRecordedFrame({ timestamp: 1500, detectionMs: 7, hands: [hand] }, 1000);
    expect(rec.t).toBe(500);
    const back = toHandFrame(rec, 2000);
    expect(back.timestamp).toBe(2500);
    expect(back.hands[0]!.image[0]).toBeCloseTo(hand.image[0]!, 4);
  });

  it('validates structure', () => {
    expect(
      isRecording(
        scriptedRecording([
          { at: 0, cx: 0.5, cy: 0.5, pinch: 0 },
          { at: 100, cx: 0.5, cy: 0.5, pinch: 0 },
        ]),
      ),
    ).toBe(true);
    expect(isRecording({ version: 1, frames: [{ t: 0, hands: [{ image: [1] }] }] })).toBe(false);
  });
});

describe('scriptedRecording', () => {
  it('samples at camera rate and supports dropouts', () => {
    const rec = scriptedRecording([
      { at: 0, cx: 0.5, cy: 0.6, pinch: 0 },
      { at: 500, cx: 0.5, cy: 0.6, pinch: 0, visible: false },
      { at: 1000, cx: 0.5, cy: 0.6, pinch: 0 },
    ]);
    expect(rec.frames.length).toBeGreaterThanOrEqual(30);
    expect(rec.frames.some((f) => f.hands.length === 0)).toBe(true);
    expect(rec.frames[0]!.hands).toHaveLength(1);
  });
});

describe('ReplayHandSource', () => {
  it('emits frames at their recorded times', () => {
    const rec = scriptedRecording([
      { at: 0, cx: 0.5, cy: 0.6, pinch: 0 },
      { at: 200, cx: 0.6, cy: 0.6, pinch: 0 },
    ]);
    const clock = fakeTime();
    let ended = false;
    const src = new ReplayHandSource(rec, { ...clock, onEnd: () => (ended = true) });
    const got: HandFrame[] = [];
    src.subscribe((f) => got.push(f));
    src.start();
    expect(got).toHaveLength(1); // t = 0
    clock.advance(100);
    expect(got.length).toBe(4); // 0, 33, 67, 100
    clock.advance(150);
    expect(got.length).toBe(rec.frames.length);
    expect(ended).toBe(true);
    expect(got.at(-1)!.timestamp).toBeCloseTo(rec.frames.at(-1)!.t);
  });

  it('loops when asked', () => {
    const rec = scriptedRecording([
      { at: 0, cx: 0.5, cy: 0.6, pinch: 0 },
      { at: 100, cx: 0.5, cy: 0.6, pinch: 0 },
    ]);
    const clock = fakeTime();
    const src = new ReplayHandSource(rec, { ...clock, loop: true });
    let n = 0;
    src.subscribe(() => n++);
    src.start();
    clock.advance(150);
    clock.advance(1);
    expect(n).toBeGreaterThan(rec.frames.length);
    src.stop();
  });
});

describe('LandmarkRecorder', () => {
  it('captures frames from any source relative to the first frame', () => {
    const listeners = new Set<(f: HandFrame) => void>();
    const source: HandSource = {
      backend: 'main-thread',
      start() {},
      stop() {},
      dispose() {},
      subscribe(l) {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    };
    const r = new LandmarkRecorder();
    r.start(source);
    const hand = synthHand({ cx: 0.5, cy: 0.6 });
    listeners.forEach((l) => l({ timestamp: 5000, detectionMs: 8, hands: [hand] }));
    listeners.forEach((l) => l({ timestamp: 5033, detectionMs: 8, hands: [] }));
    const rec = r.export(16 / 9, 'test');
    expect(rec.frames.map((f) => f.t)).toEqual([0, 33]);
    expect(isRecording(rec)).toBe(true);
    expect(r.recording).toBe(false);
    expect(listeners.size).toBe(0);
  });
});
