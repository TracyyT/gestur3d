import { HandLandmark as L } from '@/core/vision/types';

/**
 * Thumb-tip to index-tip distance divided by palm size (wrist → middle MCP).
 * Uses 3D world landmarks when present: they're metric and don't shrink when
 * the pinch is seen edge-on. Falls back to aspect-corrected image landmarks.
 * Typical values: ~0.1–0.25 pinched, ~0.8–1.3 relaxed open hand.
 */
export function pinchRatio(
  world: ArrayLike<number>,
  image: ArrayLike<number>,
  aspect = 16 / 9,
): number {
  const useWorld =
    world.length === 63 && (world[L.MiddleMcp * 3] !== 0 || world[L.MiddleMcp * 3 + 1] !== 0);
  const p = useWorld ? world : image;
  const sx = useWorld ? 1 : aspect;
  const sz = useWorld ? 1 : aspect;
  const d = (a: number, b: number) =>
    Math.hypot(
      (p[a * 3]! - p[b * 3]!) * sx,
      p[a * 3 + 1]! - p[b * 3 + 1]!,
      (p[a * 3 + 2]! - p[b * 3 + 2]!) * sz,
    );
  const palm = d(L.Wrist, L.MiddleMcp);
  return palm > 1e-6 ? d(L.ThumbTip, L.IndexTip) / palm : Infinity;
}

export interface PinchThresholds {
  /** Ratio below which a pinch starts. */
  enter: number;
  /** Ratio above which a pinch ends (> enter: hysteresis). */
  exit: number;
  /** Ratio treated as "fully open" for the 0..1 strength readout. */
  open: number;
  /** Pinch must stay closed this long before it counts. */
  minHoldMs: number;
}

/**
 * Thresholds from the 0..1 "Gesture sensitivity" setting. Higher sensitivity
 * starts a pinch with the fingers further apart.
 */
export function sensitivityToThresholds(sensitivity: number): PinchThresholds {
  const s = Math.min(1, Math.max(0, sensitivity));
  const enter = 0.22 + 0.16 * s; // 0.22 .. 0.38 (0.30 at default)
  return { enter, exit: enter + 0.15, open: 1.0, minHoldMs: 60 };
}

export interface PinchState {
  /** 0 = fully open, 1 = fingers touching. For UI feedback. */
  strength: number;
  /** Debounced pinch state used for grabbing. */
  active: boolean;
  /** True on the update where `active` became true. */
  started: boolean;
  /** True on the update where `active` became false. */
  ended: boolean;
  /**
   * Still pinched, but the fingers have opened past the start threshold
   * (between enter and exit). The user is letting go: held objects should
   * stop following, so release can't nudge them.
   */
  releasing?: boolean;
  /** Fingers are closed right now (ratio below the start threshold), before debouncing. */
  closed?: boolean;
}

/** Turns a noisy pinch ratio into a debounced, hysteretic on/off signal. */
export class PinchDetector {
  thresholds: PinchThresholds;
  private active = false;
  private closedSince: number | null = null;

  constructor(thresholds: PinchThresholds) {
    this.thresholds = thresholds;
  }

  update(ratio: number, tMs: number): PinchState {
    const { enter, exit, open, minHoldMs } = this.thresholds;
    const strength = Number.isFinite(ratio)
      ? Math.min(1, Math.max(0, (open - ratio) / (open - enter * 0.5)))
      : 0;
    let started = false;
    let ended = false;

    if (!this.active) {
      if (ratio < enter) {
        this.closedSince ??= tMs;
        if (tMs - this.closedSince >= minHoldMs) {
          this.active = true;
          started = true;
        }
      } else {
        this.closedSince = null;
      }
    } else if (ratio > exit) {
      this.active = false;
      this.closedSince = null;
      ended = true;
    }
    const releasing = this.active && ratio > enter;
    return { strength, active: this.active, started, ended, releasing, closed: ratio < enter };
  }

  reset() {
    this.active = false;
    this.closedSince = null;
  }
}
