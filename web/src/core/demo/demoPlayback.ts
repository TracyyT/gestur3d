import type { RecordedFrame, Recording } from '@/core/vision/recording';

/**
 * Playback helpers for demo hands: which frame to show at a time, and the
 * region of the camera frame the motion covers (so a demo can zoom to it).
 */

/** Recording length in ms. */
export function duration(rec: Recording): number {
  return rec.frames.at(-1)?.t ?? 0;
}

/** The last frame at or before `t` (clamped to the recording). */
export function frameAt(rec: Recording, t: number): RecordedFrame | null {
  const f = rec.frames;
  if (!f.length) return null;
  let lo = 0;
  let hi = f.length - 1;
  if (t <= f[0]!.t) return f[0]!;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (f[mid]!.t <= t) lo = mid;
    else hi = mid - 1;
  }
  return f[lo]!;
}

/** Looping time: play, then hold the last frame for `pauseMs`, then repeat. */
export function loopTime(elapsed: number, rec: Recording, pauseMs = 800): number {
  const d = duration(rec);
  const period = d + pauseMs;
  if (period <= 0) return 0;
  return Math.min(d, ((elapsed % period) + period) % period);
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The square-ish box (camera-normalized, unmirrored) that holds every
 * landmark of every frame, padded by `pad` of its size, with the camera
 * frame's aspect applied so the hand isn't stretched.
 */
export function motionBounds(rec: Recording, pad = 0.15): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of rec.frames)
    for (const h of f.hands)
      for (let i = 0; i < 21; i++) {
        const x = h.image[i * 3]!;
        const y = h.image[i * 3 + 1]!;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  if (!Number.isFinite(minX)) return null;
  // Work in a space where x and y have the same scale.
  const a = rec.cameraAspect;
  let w = (maxX - minX) * a;
  let h = maxY - minY;
  const side = Math.max(w, h) * (1 + 2 * pad);
  const cx = ((minX + maxX) / 2) * a;
  const cy = (minY + maxY) / 2;
  w = side;
  h = side;
  return { x: (cx - w / 2) / a, y: cy - h / 2, width: w / a, height: h };
}
