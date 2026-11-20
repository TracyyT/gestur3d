import { HandLandmark, type TrackedHand } from './types';

/**
 * Apparent hand size in the frame: wrist → middle-finger MCP distance, in
 * image-normalized units (scaled by aspect so x and y are comparable).
 * A stable proxy for distance from the camera.
 */
export function palmSize(hand: Pick<TrackedHand, 'image'>, aspect = 16 / 9): number {
  const w = HandLandmark.Wrist * 3;
  const m = HandLandmark.MiddleMcp * 3;
  const dx = (hand.image[m]! - hand.image[w]!) * aspect;
  const dy = hand.image[m + 1]! - hand.image[w + 1]!;
  return Math.hypot(dx, dy);
}

export type DistanceStatus = 'too-far' | 'good' | 'too-close';

/** Thresholds tuned for a laptop webcam at 720p; refined during calibration work in M2. */
export const DISTANCE_RANGE = { min: 0.11, max: 0.32 } as const;

export function distanceStatus(size: number, range = DISTANCE_RANGE): DistanceStatus {
  if (size < range.min) return 'too-far';
  if (size > range.max) return 'too-close';
  return 'good';
}

export type LightingStatus = 'dark' | 'good' | 'bright';

/** Mean relative luminance (0..1) of RGBA pixel data, sampling every `stride`-th pixel. */
export function meanLuminance(rgba: Uint8ClampedArray, stride = 4): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < rgba.length; i += 4 * stride) {
    sum += 0.2126 * rgba[i]! + 0.7152 * rgba[i + 1]! + 0.0722 * rgba[i + 2]!;
    n++;
  }
  return n ? sum / n / 255 : 0;
}

export function lightingStatus(luminance: number): LightingStatus {
  if (luminance < 0.16) return 'dark';
  if (luminance > 0.85) return 'bright';
  return 'good';
}

/** True if every landmark sits inside the frame with a small margin. */
export function handFullyInFrame(hand: Pick<TrackedHand, 'image'>, margin = 0.02): boolean {
  for (let i = 0; i < hand.image.length; i += 3) {
    const x = hand.image[i]!;
    const y = hand.image[i + 1]!;
    if (x < margin || x > 1 - margin || y < margin || y > 1 - margin) return false;
  }
  return true;
}
