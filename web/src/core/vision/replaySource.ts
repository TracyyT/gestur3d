import { toHandFrame, toRecordedFrame, type Recording } from './recording';
import type { HandFrame, HandSource } from './types';

export interface ReplayOptions {
  loop?: boolean;
  /** Playback speed multiplier. */
  speed?: number;
  /** Clock and scheduler, injectable for tests. */
  now?: () => number;
  schedule?: (cb: () => void) => number;
  cancel?: (handle: number) => void;
  onEnd?: () => void;
}

/**
 * Plays a landmark recording through the same HandSource interface as the
 * live detector, at its original timing.
 */
export class ReplayHandSource implements HandSource {
  readonly backend = 'replay' as const;
  private listeners = new Set<(f: HandFrame) => void>();
  private handle: number | null = null;
  private startedAt = 0;
  private index = 0;
  private readonly recording: Recording;
  private readonly opts: Required<Omit<ReplayOptions, 'onEnd'>> & Pick<ReplayOptions, 'onEnd'>;

  constructor(recording: Recording, options: ReplayOptions = {}) {
    this.recording = recording;
    this.opts = {
      loop: options.loop ?? false,
      speed: options.speed ?? 1,
      now: options.now ?? (() => performance.now()),
      schedule: options.schedule ?? ((cb) => requestAnimationFrame(cb)),
      cancel: options.cancel ?? ((h) => cancelAnimationFrame(h)),
      onEnd: options.onEnd,
    };
  }

  get cameraAspect() {
    return this.recording.cameraAspect;
  }

  start() {
    if (this.handle !== null) return;
    this.startedAt = this.opts.now();
    this.index = 0;
    this.tick();
  }

  stop() {
    if (this.handle !== null) this.opts.cancel(this.handle);
    this.handle = null;
  }

  subscribe(listener: (f: HandFrame) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    this.stop();
    this.listeners.clear();
  }

  private tick = () => {
    const frames = this.recording.frames;
    const elapsed = (this.opts.now() - this.startedAt) * this.opts.speed;
    while (this.index < frames.length && frames[this.index]!.t <= elapsed) {
      const rec = frames[this.index++]!;
      const frame = toHandFrame(rec, 0);
      frame.timestamp = this.startedAt + rec.t / this.opts.speed;
      this.listeners.forEach((l) => l(frame));
    }
    if (this.index >= frames.length) {
      if (this.opts.loop && frames.length) {
        this.startedAt = this.opts.now();
        this.index = 0;
      } else {
        this.handle = null;
        this.opts.onEnd?.();
        return;
      }
    }
    this.handle = this.opts.schedule(this.tick);
  };
}

/** Captures frames from any HandSource into a Recording (landmarks only). */
export class LandmarkRecorder {
  private frames: Recording['frames'] = [];
  private t0: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private readonly maxMs: number;

  constructor(maxMs = 60_000) {
    this.maxMs = maxMs;
  }

  get recording() {
    return this.unsubscribe !== null;
  }

  get frameCount() {
    return this.frames.length;
  }

  start(source: HandSource) {
    this.stop();
    this.frames = [];
    this.t0 = null;
    this.unsubscribe = source.subscribe((frame) => {
      this.t0 ??= frame.timestamp;
      if (frame.timestamp - this.t0 > this.maxMs) return this.stop();
      this.frames.push(toRecordedFrame(frame, this.t0));
    });
  }

  stop() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Finish and return the recording. */
  export(cameraAspect: number, label?: string): Recording {
    this.stop();
    return {
      version: 1,
      spec: 'v0',
      cameraAspect,
      createdAt: new Date().toISOString(),
      label,
      frames: this.frames,
    };
  }
}
