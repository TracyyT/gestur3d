import { HoldTracker, type HoldState } from './holdTracker';
import { isOpenPalm } from './rules/openPalm';

export interface OpenPalmInput {
  /** World landmarks (63 values). */
  world: ArrayLike<number>;
  /** A point that moves with the hand (e.g. the cursor anchor), camera-normalized. */
  center: readonly [number, number];
  /** True if the hand may open the menu now (not holding anything, no two-hand grab). */
  allowed: boolean;
}

export interface OpenPalmOptions {
  holdMs: number;
  /** Short dropouts (a frame or two not matching) don't reset the hold. */
  graceMs: number;
  /** Hand must move slower than this (camera-normalized units per second). */
  maxSpeed: number;
}

export const DEFAULT_OPEN_PALM_OPTIONS: OpenPalmOptions = {
  holdMs: 600,
  graceMs: 120,
  maxSpeed: 0.2,
};

/**
 * Turns per-frame open-palm checks into a deliberate hold: the pose, held
 * nearly still, for `holdMs`. `progress` drives the hold ring; `completed` is
 * true once, when the menu should open. After that the hand has to leave the
 * pose before it can fire again.
 */
export class OpenPalmDetector {
  private readonly opts: OpenPalmOptions;
  private readonly hold: HoldTracker;
  private last: { t: number; x: number; y: number } | null = null;
  private speed = 0;

  constructor(opts: Partial<OpenPalmOptions> = {}) {
    this.opts = { ...DEFAULT_OPEN_PALM_OPTIONS, ...opts };
    this.hold = new HoldTracker(this.opts.holdMs, this.opts.graceMs);
  }

  update(now: number, input: OpenPalmInput | null): HoldState & { posing: boolean } {
    let posing = false;
    if (input) {
      const [x, y] = input.center;
      if (this.last && now > this.last.t) {
        const v = Math.hypot(x - this.last.x, y - this.last.y) / ((now - this.last.t) / 1000);
        // Light smoothing so one noisy frame doesn't count as movement.
        this.speed += (v - this.speed) * 0.5;
      }
      this.last = { t: now, x, y };
      posing = input.allowed && this.speed < this.opts.maxSpeed && isOpenPalm(input.world);
    } else {
      this.last = null;
      this.speed = 0;
    }
    return { ...this.hold.update(now, posing), posing };
  }
}
