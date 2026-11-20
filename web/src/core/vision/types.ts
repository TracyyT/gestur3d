/**
 * Shared vision types. Coordinate conventions (see shared/landmark-spec):
 * - Detection runs on the RAW (unmirrored) camera frame.
 * - `image` landmarks: x, y normalized to [0, 1] of the raw frame, origin top-left;
 *   z is depth relative to the wrist (smaller = closer to camera), roughly x scale.
 * - `world` landmarks: meters, origin near the hand's center.
 * - `handedness` is the user's own hand ("Right" = the user's right hand).
 * - The UI mirrors only the DISPLAY (selfie view); data stays unmirrored.
 */

export const LANDMARKS_PER_HAND = 21;
export const VALUES_PER_LANDMARK = 3;

export type Handedness = 'Left' | 'Right';

export interface TrackedHand {
  handedness: Handedness;
  /** Confidence of the handedness classification, 0..1. */
  handednessScore: number;
  /** 21 × (x, y, z), image-normalized. Length 63. */
  image: Float32Array;
  /** 21 × (x, y, z), meters. Length 63. */
  world: Float32Array;
}

export interface HandFrame {
  /** performance.now() timestamp of the camera frame that was processed. */
  timestamp: number;
  /** Time spent inside the detector for this frame, ms. */
  detectionMs: number;
  hands: TrackedHand[];
}

export type VisionBackend = 'main-thread' | 'worker' | 'replay';

/**
 * Anything that produces HandFrames: live MediaPipe on the main thread (M1),
 * a Web Worker (M2), or a recorded landmark file (tests and replay).
 */
export interface HandSource {
  readonly backend: VisionBackend;
  start(): void;
  stop(): void;
  subscribe(listener: (frame: HandFrame) => void): () => void;
  dispose(): void;
}

/** MediaPipe hand landmark indices. */
export const HandLandmark = {
  Wrist: 0,
  ThumbCmc: 1,
  ThumbMcp: 2,
  ThumbIp: 3,
  ThumbTip: 4,
  IndexMcp: 5,
  IndexPip: 6,
  IndexDip: 7,
  IndexTip: 8,
  MiddleMcp: 9,
  MiddlePip: 10,
  MiddleDip: 11,
  MiddleTip: 12,
  RingMcp: 13,
  RingPip: 14,
  RingDip: 15,
  RingTip: 16,
  PinkyMcp: 17,
  PinkyPip: 18,
  PinkyDip: 19,
  PinkyTip: 20,
} as const;

/** Bone connections for drawing a hand skeleton. */
export const HAND_BONES: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];
