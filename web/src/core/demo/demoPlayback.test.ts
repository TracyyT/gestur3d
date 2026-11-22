import { describe, expect, it } from 'vitest';
import { scriptedRecording } from '@/core/tracking/scripts';
import { duration, frameAt, loopTime, motionBounds } from './demoPlayback';

const rec = scriptedRecording(
  [
    { at: 0, cx: 0.4, cy: 0.5, pinch: 0 },
    { at: 600, cx: 0.6, cy: 0.5, pinch: 1 },
  ],
  { aspect: 16 / 9, fps: 30 },
);

describe('demo playback', () => {
  it('finds the frame at a time, clamped at both ends', () => {
    expect(frameAt(rec, -50)).toBe(rec.frames[0]);
    expect(frameAt(rec, 99_999)).toBe(rec.frames.at(-1));
    const f = frameAt(rec, 300)!;
    expect(f.t).toBeLessThanOrEqual(300);
    const next = rec.frames[rec.frames.indexOf(f) + 1];
    expect(next === undefined || next.t > 300).toBe(true);
  });

  it('loops with a hold on the last frame', () => {
    const d = duration(rec);
    expect(loopTime(d + 100, rec, 800)).toBe(d);
    expect(loopTime(d + 800 + 50, rec, 800)).toBe(50);
  });

  it('bounds hold every landmark and are square in screen space', () => {
    const b = motionBounds(rec)!;
    for (const f of rec.frames)
      for (const h of f.hands)
        for (let i = 0; i < 21; i++) {
          const x = h.image[i * 3]!;
          const y = h.image[i * 3 + 1]!;
          expect(x).toBeGreaterThanOrEqual(b.x);
          expect(x).toBeLessThanOrEqual(b.x + b.width);
          expect(y).toBeGreaterThanOrEqual(b.y);
          expect(y).toBeLessThanOrEqual(b.y + b.height);
        }
    expect(b.width * rec.cameraAspect).toBeCloseTo(b.height, 9);
  });

  it('an empty recording has no frames or bounds', () => {
    const empty = { ...rec, frames: [] };
    expect(frameAt(empty, 0)).toBeNull();
    expect(motionBounds(empty)).toBeNull();
    expect(loopTime(500, empty, 0)).toBe(0);
  });
});
