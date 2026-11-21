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
  /** Ratio treated as "fully open" for the strength readout. */
  open: number;
  /** Fingers must stay closed this long before a pinch starts. */
  minHoldMs: number;
  /** Fingers must stay open past `exit` this long before a pinch ends. */
  releaseHoldMs: number;
}

/**
 * Thresholds from the 0..1 "Gesture sensitivity" setting.
 *
 * Calibrated against a real hand on the reference MacBook: with fingertips
 * touching, MediaPipe's tip landmarks sit ~1.5–3 cm apart, so the ratio to
 * palm size lands around 0.3–0.45, higher than synthetic hands. The wide
 * enter/exit gap means a grip that loosens slightly while moving doesn't drop
 * the object.
 */
export function sensitivityToThresholds(sensitivity: number): PinchThresholds {
  const s = Math.min(1, Math.max(0, sensitivity));
  const enter = 0.37 + 0.16 * s; // 0.37 .. 0.53 (0.45 at default)
  return { enter, exit: enter + 0.2, open: 1.1, minHoldMs: 50, releaseHoldMs: 70 };
}

export interface PinchState {
  /**
   * 0 = fully open, 1 = closed enough to grab (ratio at or below `enter`).
   * The HUD bar is full exactly when a grab can start.
   */
  strength: number;
  /** Smoothed thumb-index / palm ratio (for calibration readouts). */
  ratio: number;
  /** Debounced pinch state used for grabbing. */
  active: boolean;
  /** True on the update where `active` became true. */
  started: boolean;
  /** True on the update where `active` became false. */
  ended: boolean;
  /**
   * Fingers have opened past `exit` and the release is being confirmed
   * (at most `releaseHoldMs`). Held objects pause so letting go can't drag them.
   */
  releasing?: boolean;
  /** Fingers are closed right now (smoothed ratio below `enter`), before debouncing. */
  closed?: boolean;
}

/** Light smoothing of the ratio so single noisy frames don't flip the state. */
const RATIO_SMOOTHING = 0.5;

/** Turns a noisy pinch ratio into a debounced, hysteretic on/off signal. */
export class PinchDetector {
  thresholds: PinchThresholds;
  private active = false;
  private closedSince: number | null = null;
  private openSince: number | null = null;
  private smoothed: number | null = null;

  constructor(thresholds: PinchThresholds) {
    this.thresholds = thresholds;
  }

  update(rawRatio: number, tMs: number): PinchState {
    const { enter, exit, open, minHoldMs, releaseHoldMs } = this.thresholds;
    const finite = Number.isFinite(rawRatio);
    if (finite) {
      this.smoothed =
        this.smoothed === null
          ? rawRatio
          : this.smoothed + (rawRatio - this.smoothed) * RATIO_SMOOTHING;
    }
    const ratio = finite ? this.smoothed! : Infinity;
    const strength = finite ? Math.min(1, Math.max(0, (open - ratio) / (open - enter))) : 0;
    let started = false;
    let ended = false;

    if (!this.active) {
      if (ratio < enter) {
        this.closedSince ??= tMs;
        if (tMs - this.closedSince >= minHoldMs) {
          this.active = true;
          this.openSince = null;
          started = true;
        }
      } else {
        this.closedSince = null;
      }
    } else if (ratio > exit) {
      this.openSince ??= tMs;
      if (tMs - this.openSince >= releaseHoldMs) {
        this.active = false;
        this.closedSince = null;
        this.openSince = null;
        ended = true;
      }
    } else {
      this.openSince = null;
    }
    const releasing = this.active && this.openSince !== null;
    return {
      strength,
      ratio,
      active: this.active,
      started,
      ended,
      releasing,
      closed: ratio < enter,
    };
  }

  reset() {
    this.active = false;
    this.closedSince = null;
    this.openSince = null;
    this.smoothed = null;
  }
}

/**
 * Apparent palm size in the image (aspect-corrected, camera-normalized): the
 * mean side of the wrist / index-knuckle / pinky-knuckle triangle. It grows as
 * the hand comes toward the camera, so it stands in for depth. Using three
 * sides makes it less sensitive to the hand rolling than one length, and none
 * of the points move when the fingers pinch.
 */
export function palmSize(image: ArrayLike<number>, aspect = 16 / 9): number {
  const d = (a: number, b: number) =>
    Math.hypot((image[a * 3]! - image[b * 3]!) * aspect, image[a * 3 + 1]! - image[b * 3 + 1]!);
  return (d(L.Wrist, L.IndexMcp) + d(L.Wrist, L.PinkyMcp) + d(L.IndexMcp, L.PinkyMcp)) / 3;
}
