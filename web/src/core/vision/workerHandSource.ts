import { RateMeter } from './rateMeter';
import type { FromWorker, ResultMessage, ToWorker } from './worker/protocol';
import type { HandFrame, HandSource, Handedness } from './types';

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { captureTime?: number }) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

export function resultToFrame(msg: ResultMessage): HandFrame {
  return {
    timestamp: msg.timestamp,
    captureTime: msg.captureTime,
    detectionMs: msg.detectionMs,
    hands: msg.handedness.map((h, i) => ({
      handedness: (h.label === 'Left' ? 'Left' : 'Right') as Handedness,
      handednessScore: h.score,
      image: msg.image.slice(i * 63, (i + 1) * 63),
      world: msg.world.slice(i * 63, (i + 1) * 63),
    })),
  };
}

/**
 * Runs MediaPipe in a Web Worker. Each new camera frame becomes an
 * ImageBitmap transferred to the worker. At most one frame is in flight;
 * frames that arrive while the worker is busy are skipped, so latency never
 * builds up in a queue.
 */
export class WorkerHandSource implements HandSource {
  readonly backend = 'worker' as const;
  readonly stats = new RateMeter(1000);
  /** Main-thread round trip per frame (send → result), ms. */
  readonly roundTrip = new RateMeter(1000);
  delegate: 'GPU' | 'CPU' | null = null;
  private listeners = new Set<(f: HandFrame) => void>();
  private worker: Worker;
  private running = false;
  private busy = false;
  private handle: number | null = null;
  private lastVideoTime = -1;
  private readonly video: VideoWithRvfc;

  constructor(video: HTMLVideoElement) {
    this.video = video;
    this.worker = new Worker(new URL('./worker/hand.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.onMessage(e.data);
  }

  /** Load the model inside the worker. Rejects if it can't start (caller falls back). */
  init(baseUrl: string, numHands = 2, timeoutMs = 15_000): Promise<'GPU' | 'CPU'> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Worker init timed out')), timeoutMs);
      const onReady = (e: MessageEvent<FromWorker>) => {
        if (e.data.type === 'ready') {
          clearTimeout(timer);
          this.worker.removeEventListener('message', onReady);
          this.delegate = e.data.delegate;
          resolve(e.data.delegate);
        } else if (e.data.type === 'error') {
          clearTimeout(timer);
          this.worker.removeEventListener('message', onReady);
          reject(new Error(e.data.message));
        }
      };
      this.worker.addEventListener('message', onReady);
      this.worker.onerror = (e) => {
        clearTimeout(timer);
        reject(new Error(e.message || 'Worker failed to load'));
      };
      this.post({ type: 'init', baseUrl, numHands, preferGpu: true });
    });
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
    this.post({ type: 'close' });
    this.worker.terminate();
  }

  private post(msg: ToWorker, transfer: Transferable[] = []) {
    this.worker.postMessage(msg, transfer);
  }

  private schedule() {
    if (!this.running) return;
    this.handle = this.video.requestVideoFrameCallback
      ? this.video.requestVideoFrameCallback((_now, meta) => this.onVideoFrame(meta.captureTime))
      : requestAnimationFrame(() => this.onVideoFrame(undefined));
  }

  private onVideoFrame(captureTime: number | undefined) {
    if (!this.running) return;
    const v = this.video;
    if (!this.busy && v.readyState >= 2 && v.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = v.currentTime;
      this.busy = true;
      const timestamp = performance.now();
      createImageBitmap(v)
        .then((bitmap) => this.post({ type: 'frame', bitmap, timestamp, captureTime }, [bitmap]))
        .catch(() => {
          this.busy = false;
        });
    }
    this.schedule();
  }

  private onMessage(msg: FromWorker) {
    if (msg.type !== 'result') return;
    this.busy = false;
    const now = performance.now();
    this.stats.tick(now, msg.detectionMs);
    this.roundTrip.tick(now, now - msg.timestamp);
    const frame = resultToFrame(msg);
    this.listeners.forEach((l) => l(frame));
  }
}
