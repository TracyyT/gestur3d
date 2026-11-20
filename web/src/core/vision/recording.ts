import type { HandFrame, Handedness } from './types';

/**
 * Landmark recordings: hand landmarks over time, never video. Used to replay
 * real hand movement through the full pipeline in tests and benchmarks, and as
 * the seed of the gesture dataset.
 */
export const RECORDING_VERSION = 1;

export interface RecordedHand {
  handedness: Handedness;
  score: number;
  /** 63 values, raw camera-normalized (unmirrored). */
  image: number[];
  /** 63 values, meters. */
  world: number[];
}

export interface RecordedFrame {
  /** ms since the recording started. */
  t: number;
  hands: RecordedHand[];
}

export interface Recording {
  version: typeof RECORDING_VERSION;
  /** Landmark spec version the coordinates follow. */
  spec: 'v0';
  /** Camera width / height when recorded. */
  cameraAspect: number;
  createdAt: string;
  /** Free-form label, e.g. "right-hand grab and move". */
  label?: string;
  frames: RecordedFrame[];
}

const round = (v: number) => Math.round(v * 1e5) / 1e5;

export function toRecordedFrame(frame: HandFrame, t0: number): RecordedFrame {
  return {
    t: Math.round((frame.timestamp - t0) * 10) / 10,
    hands: frame.hands.map((h) => ({
      handedness: h.handedness,
      score: round(h.handednessScore),
      image: Array.from(h.image, round),
      world: Array.from(h.world, round),
    })),
  };
}

/** Rebuild a HandFrame as if it had just been detected at `startedAt + t`. */
export function toHandFrame(rec: RecordedFrame, startedAt: number): HandFrame {
  return {
    timestamp: startedAt + rec.t,
    detectionMs: 0,
    hands: rec.hands.map((h) => ({
      handedness: h.handedness,
      handednessScore: h.score,
      image: Float32Array.from(h.image),
      world: Float32Array.from(h.world),
    })),
  };
}

/** Basic structural validation for recordings loaded from files. */
export function isRecording(value: unknown): value is Recording {
  const r = value as Recording | null;
  return (
    !!r &&
    r.version === RECORDING_VERSION &&
    typeof r.cameraAspect === 'number' &&
    Array.isArray(r.frames) &&
    r.frames.every(
      (f) =>
        typeof f.t === 'number' &&
        Array.isArray(f.hands) &&
        f.hands.every((h) => h.image?.length === 63 && h.world?.length === 63),
    )
  );
}
