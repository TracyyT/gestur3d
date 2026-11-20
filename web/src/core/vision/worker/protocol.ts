/** Messages between the main thread and the hand-detection worker. */

export interface InitMessage {
  type: 'init';
  /** Absolute URL of the self-hosted MediaPipe directory. */
  baseUrl: string;
  numHands: number;
  preferGpu: boolean;
}

export interface FrameMessage {
  type: 'frame';
  bitmap: ImageBitmap;
  /** Main-thread performance.now() when the frame was sent. */
  timestamp: number;
  captureTime?: number;
}

export type ToWorker = InitMessage | FrameMessage | { type: 'close' };

export interface ReadyMessage {
  type: 'ready';
  delegate: 'GPU' | 'CPU';
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export interface ResultMessage {
  type: 'result';
  timestamp: number;
  captureTime?: number;
  detectionMs: number;
  /** Per hand: handedness label and score. */
  handedness: Array<{ label: string; score: number }>;
  /** Hands × 63 values, image-normalized. */
  image: Float32Array;
  /** Hands × 63 values, meters. */
  world: Float32Array;
}

export type FromWorker = ReadyMessage | ErrorMessage | ResultMessage;
