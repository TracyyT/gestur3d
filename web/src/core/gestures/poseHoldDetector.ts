import { HoldTracker, type HoldState } from './holdTracker';

export interface PoseHoldInput {
  /** World landmarks (63 values). */
  world: ArrayLike<number>;
  /** A point that moves with the hand (e.g. the cursor anchor), camera-normalized. */
  center: readonly [number, number];
  /** True if the hand may open the menu now (not holding anything, no two-hand grab). */
  allowed: boolean;
}

export interface PoseHoldOptions {
  holdMs: number;
  /** Short dropouts (a frame or two not matching) don't reset the hold. */
  graceMs: number;
  /** Hand must move slower than this (camera-normalized units per second). */
  maxSpeed: number;
}

export const DEFAULT_POSE_HOLD_OPTIONS: PoseHoldOptions = {
  holdMs: 600,
  graceMs: 120,
  maxSpeed: 0.2,
};

/**
 * Turns a per-frame pose check (e.g. `isPointing`) into a deliberate hold: the
 * pose, held nearly still, for `holdMs`. `progress` drives the hold ring; `completed` is
 * true once, when the menu should open. After that the hand has to leave the
 * pose before it can fire again.
 */
export class PoseHoldDetector {
  private readonly opts: PoseHoldOptions;
  private readonly pose: (world: ArrayLike<number>) => boolean;
  private readonly hold: HoldTracker;
  private last: { t: number; x: number; y: number } | null = null;
  private speed = 0;

  constructor(pose: (world: ArrayLike<number>) => boolean, opts: Partial<PoseHoldOptions> = {}) {
    this.pose = pose;
    this.opts = { ...DEFAULT_POSE_HOLD_OPTIONS, ...opts };
    this.hold = new HoldTracker(this.opts.holdMs, this.opts.graceMs);
  }

  update(now: number, input: PoseHoldInput | null): HoldState & { posing: boolean } {
    let posing = false;
    if (input) {
      const [x, y] = input.center;
      if (this.last && now > this.last.t) {
        const v = Math.hypot(x - this.last.x, y - this.last.y) / ((now - this.last.t) / 1000);
        // Light smoothing so one noisy frame doesn't count as movement.
        this.speed += (v - this.speed) * 0.5;
      }
      this.last = { t: now, x, y };
      posing = input.allowed && this.speed < this.opts.maxSpeed && this.pose(input.world);
    } else {
      this.last = null;
      this.speed = 0;
    }
    return { ...this.hold.update(now, posing), posing };
  }
}
