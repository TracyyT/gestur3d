import type { Recording } from '@/core/vision/recording';
import { toRecordedFrame } from '@/core/vision/recording';
import type { Handedness } from '@/core/vision/types';
import { synthHand } from './synthetic';

/**
 * Scripted synthetic recordings: keyframes interpolated at camera rate.
 * Positions are raw camera-normalized wrist coordinates (unmirrored).
 */
export interface Keyframe {
  /** ms from start. */
  at: number;
  cx: number;
  cy: number;
  pinch: number;
  /** false = hand not detected at this keyframe (tracking dropout). */
  visible?: boolean;
}

export interface ScriptOptions {
  handedness?: Handedness;
  size?: number;
  fps?: number;
  aspect?: number;
  label?: string;
  /** Uniform noise amplitude added to landmarks (camera-normalized). */
  jitter?: number;
}

function noise(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
}

export function scriptedRecording(keys: Keyframe[], opts: ScriptOptions = {}): Recording {
  const { handedness = 'Right', size = 0.12, fps = 30, aspect = 16 / 9, label, jitter = 0 } = opts;
  const rnd = noise(42);
  const end = keys.at(-1)!.at;
  const frames: Recording['frames'] = [];
  for (let t = 0; t <= end + 1e-6; t += 1000 / fps) {
    let i = 0;
    while (i < keys.length - 2 && keys[i + 1]!.at <= t) i++;
    const a = keys[i]!;
    const b = keys[Math.min(i + 1, keys.length - 1)]!;
    const k = b.at === a.at ? 0 : Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at)));
    const visible = (k < 0.5 ? a.visible : b.visible) !== false;
    const hands = [];
    if (visible) {
      const hand = synthHand({
        cx: a.cx + (b.cx - a.cx) * k,
        cy: a.cy + (b.cy - a.cy) * k,
        pinch: a.pinch + (b.pinch - a.pinch) * k,
        size,
        handedness,
        aspect,
      });
      if (jitter) for (let j = 0; j < 63; j++) if (j % 3 !== 2) hand.image[j]! += jitter * rnd();
      hands.push(hand);
    }
    frames.push(toRecordedFrame({ timestamp: t, detectionMs: 0, hands }, 0));
  }
  return {
    version: 1,
    spec: 'v0',
    cameraAspect: aspect,
    createdAt: '2026-11-20T00:00:00.000Z',
    label,
    frames,
  };
}
