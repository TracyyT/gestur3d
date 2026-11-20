import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import { RateMeter } from './rateMeter';
import type { HandFrame, HandSource, Handedness, TrackedHand } from './types';

/** Self-hosted by scripts/prepare-models.mjs. */
export const MEDIAPIPE_BASE = '/models/mediapipe';

export type Delegate = 'GPU' | 'CPU';

export interface LoadedHandLandmarker {
  landmarker: HandLandmarker;
  delegate: Delegate;
}

/** Load the Hand Landmarker, preferring the GPU delegate and falling back to CPU. */
export async function loadHandLandmarker(numHands = 2): Promise<LoadedHandLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(`${MEDIAPIPE_BASE}/wasm`);
  const create = (delegate: Delegate) =>
    HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${MEDIAPIPE_BASE}/hand_landmarker.task`, delegate },
      runningMode: 'VIDEO',
      numHands,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
  try {
    return { landmarker: await create('GPU'), delegate: 'GPU' };
  } catch {
    return { landmarker: await create('CPU'), delegate: 'CPU' };
  }
}

function flatten(points: ReadonlyArray<{ x: number; y: number; z: number }>): Float32Array {
  const out = new Float32Array(points.length * 3);
  points.forEach((p, i) => {
    out[i * 3] = p.x;
    out[i * 3 + 1] = p.y;
    out[i * 3 + 2] = p.z;
  });
  return out;
}

/** Convert a MediaPipe result into our framework-free HandFrame. */
export function toHandFrame(
  result: HandLandmarkerResult,
  timestamp: number,
  detectionMs: number,
): HandFrame {
  const hands: TrackedHand[] = result.landmarks.map((lm, i) => {
    const cat = result.handedness[i]?.[0];
    return {
      // Input frames are unmirrored, so labels already describe the user's own hands.
      handedness: (cat?.categoryName === 'Left' ? 'Left' : 'Right') as Handedness,
      handednessScore: cat?.score ?? 0,
      image: flatten(lm),
      world: flatten(result.worldLandmarks[i] ?? []),
    };
  });
  return { timestamp, detectionMs, hands };
}

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/**
 * Runs the Hand Landmarker on the main thread, once per new video frame.
 * M1 uses this on the setup screen only; M2 adds a worker-backed HandSource
 * behind the same interface.
 */
export class MainThreadHandSource implements HandSource {
  readonly backend = 'main-thread' as const;
  readonly stats = new RateMeter(1000);
  private listeners = new Set<(f: HandFrame) => void>();
  private running = false;
  private handle: number | null = null;
  private lastVideoTime = -1;
  private readonly video: VideoWithRvfc;
  private readonly landmarker: HandLandmarker;

  constructor(video: HTMLVideoElement, landmarker: HandLandmarker) {
    this.video = video;
    this.landmarker = landmarker;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  stop() {
    this.running = false;
    if (this.handle !== null) {
      if (this.video.cancelVideoFrameCallback) this.video.cancelVideoFrameCallback(this.handle);
      else cancelAnimationFrame(this.handle);
      this.handle = null;
    }
  }

  subscribe(listener: (f: HandFrame) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    this.stop();
    this.listeners.clear();
  }

  private schedule() {
    if (!this.running) return;
    // requestVideoFrameCallback fires once per decoded frame, so we never run
    // detection twice on the same image. Fall back to rAF where unsupported.
    this.handle = this.video.requestVideoFrameCallback
      ? this.video.requestVideoFrameCallback(this.process)
      : requestAnimationFrame(this.process);
  }

  private process = () => {
    if (!this.running) return;
    const v = this.video;
    if (v.readyState >= 2 && v.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = v.currentTime;
      const t0 = performance.now();
      const result = this.landmarker.detectForVideo(v, t0);
      const t1 = performance.now();
      this.stats.tick(t1, t1 - t0);
      const frame = toHandFrame(result, t0, t1 - t0);
      this.listeners.forEach((l) => l(frame));
    }
    this.schedule();
  };
}
