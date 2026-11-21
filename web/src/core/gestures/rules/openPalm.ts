import { HandLandmark as L } from '@/core/vision/types';

/** Thresholds for `isOpenPalm`; exported for tests and tuning. */
export const OPEN_PALM = {
  /** Palm normal within this angle of the camera axis (degrees). */
  maxFacingDeg: 35,
  /** Each fingertip at least this × farther from the wrist than its PIP joint. */
  extended: 1.15,
  /** Index and pinky at least this far apart in direction (degrees): a deliberate spread. */
  minSpreadDeg: 35,
  /** Thumb tip at least this × palm length from the index knuckle. */
  thumbOut: 0.6,
} as const;

type V = [number, number, number];

/**
 * Rule-based "open palm toward the camera, fingers spread" on world
 * landmarks (metric 3D, so finger lengths and angles don't depend on how the
 * hand is turned). It opens the radial menu, so it is strict:
 *
 *  1. the palm faces the camera: its normal (wrist→index knuckle ×
 *     wrist→pinky knuckle) is within 35° of the camera axis. Either side
 *     counts, because MediaPipe's left/right labels aren't reliable enough to
 *     tell palm from back;
 *  2. all four fingers are extended (tip well past the PIP joint);
 *  3. the fingers are spread: index and pinky point at least 35° apart. A
 *     relaxed open hand, as when aiming at an object, is usually narrower;
 *  4. the thumb is out, away from the index knuckle.
 *
 * Stillness and the hold time are handled by `OpenPalmDetector`.
 */
export function isOpenPalm(world: ArrayLike<number>): boolean {
  const p = (i: number): V => [world[i * 3]!, world[i * 3 + 1]!, world[i * 3 + 2]!];
  const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
  const dist = (a: number, b: number) => len(sub(p(a), p(b)));
  const angle = (a: V, b: V) => {
    const d = len(a) * len(b);
    return d > 0
      ? (Math.acos(Math.min(1, Math.max(-1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / d))) *
          180) /
          Math.PI
      : 180;
  };

  const palm = dist(L.Wrist, L.MiddleMcp);
  if (!(palm > 1e-6)) return false;

  const u = sub(p(L.IndexMcp), p(L.Wrist));
  const v = sub(p(L.PinkyMcp), p(L.Wrist));
  const n: V = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const nl = len(n);
  if (!(nl > 0)) return false;
  if (Math.abs(n[2]) / nl < Math.cos((OPEN_PALM.maxFacingDeg * Math.PI) / 180)) return false;

  const fingers: Array<[pip: number, tip: number]> = [
    [L.IndexPip, L.IndexTip],
    [L.MiddlePip, L.MiddleTip],
    [L.RingPip, L.RingTip],
    [L.PinkyPip, L.PinkyTip],
  ];
  if (!fingers.every(([pip, tip]) => dist(tip, L.Wrist) > OPEN_PALM.extended * dist(pip, L.Wrist)))
    return false;

  const spread = angle(sub(p(L.IndexTip), p(L.IndexMcp)), sub(p(L.PinkyTip), p(L.PinkyMcp)));
  if (spread < OPEN_PALM.minSpreadDeg) return false;

  return dist(L.ThumbTip, L.IndexMcp) > OPEN_PALM.thumbOut * palm;
}

/**
 * A closed hand: all four fingertips nearer the wrist than their PIP joints
 * (world landmarks). Used to close the radial menu.
 */
export function isFist(world: ArrayLike<number>): boolean {
  const d = (a: number, b: number) =>
    Math.hypot(
      world[a * 3]! - world[b * 3]!,
      world[a * 3 + 1]! - world[b * 3 + 1]!,
      world[a * 3 + 2]! - world[b * 3 + 2]!,
    );
  if (!(d(L.Wrist, L.MiddleMcp) > 1e-6)) return false;
  return (
    [
      [L.IndexPip, L.IndexTip],
      [L.MiddlePip, L.MiddleTip],
      [L.RingPip, L.RingTip],
      [L.PinkyPip, L.PinkyTip],
    ] as const
  ).every(([pip, tip]) => d(tip, L.Wrist) < d(pip, L.Wrist));
}
