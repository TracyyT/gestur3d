export interface HoldState {
  /** 0..1 progress toward completing the hold. */
  progress: number;
  /** True exactly once, on the update where the hold completes. */
  completed: boolean;
}

/**
 * Turns a noisy per-frame "is the gesture showing?" signal into a deliberate
 * press-and-hold. Short dropouts (a missed frame or two) are tolerated; a
 * longer gap resets progress. After completing, the gesture must be released
 * before it can fire again (no repeat-fire while held).
 */
export class HoldTracker {
  private readonly holdMs: number;
  private readonly graceMs: number;
  private startedAt: number | null = null;
  private lastSeenAt: number | null = null;
  private fired = false;

  constructor(holdMs = 1000, graceMs = 200) {
    this.holdMs = holdMs;
    this.graceMs = graceMs;
  }

  update(now: number, active: boolean): HoldState {
    if (active) {
      this.lastSeenAt = now;
      if (this.startedAt === null) this.startedAt = now;
    } else if (this.lastSeenAt === null || now - this.lastSeenAt > this.graceMs) {
      this.startedAt = null;
      this.lastSeenAt = null;
      this.fired = false;
    }

    if (this.startedAt === null || this.fired)
      return { progress: this.fired ? 1 : 0, completed: false };
    const progress = Math.min(1, (now - this.startedAt) / this.holdMs);
    if (progress >= 1) {
      this.fired = true;
      return { progress: 1, completed: true };
    }
    return { progress, completed: false };
  }

  reset() {
    this.startedAt = null;
    this.lastSeenAt = null;
    this.fired = false;
  }
}
