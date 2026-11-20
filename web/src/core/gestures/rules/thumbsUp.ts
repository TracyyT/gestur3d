import { HandLandmark as L } from '@/core/vision/types';

/**
 * Rule-based thumbs-up detector on raw image landmarks (63 values).
 *
 * Deliberately simple and conservative: it's used as a confirm gesture,
 * where a false positive is worse than a miss, and it doubles as one of the
 * rule-based baselines the trained classifiers are compared against (M5).
 *
 * A thumbs-up means:
 *  1. index, middle, ring and pinky are curled (each tip closer to the wrist
 *     than its PIP joint)
 *  2. the thumb is extended (tip farther from the wrist than its IP joint,
 *     and well away from the index knuckle)
 *  3. the thumb points up (within ~40° of vertical)
 *  4. the thumb tip is the highest point of the hand
 *
 * None of the rules depend on left/right, so it works for either hand.
 */
export function isThumbsUp(image: ArrayLike<number>, aspect = 16 / 9): boolean {
  const x = (i: number) => image[i * 3]! * aspect;
  const y = (i: number) => image[i * 3 + 1]!;
  const dist = (a: number, b: number) => Math.hypot(x(a) - x(b), y(a) - y(b));

  const palm = dist(L.Wrist, L.MiddleMcp);
  if (palm < 1e-4) return false;

  const fingers: Array<[pip: number, tip: number]> = [
    [L.IndexPip, L.IndexTip],
    [L.MiddlePip, L.MiddleTip],
    [L.RingPip, L.RingTip],
    [L.PinkyPip, L.PinkyTip],
  ];
  const curled = fingers.every(([pip, tip]) => dist(tip, L.Wrist) < dist(pip, L.Wrist));
  if (!curled) return false;

  const thumbExtended =
    dist(L.ThumbTip, L.Wrist) > dist(L.ThumbIp, L.Wrist) &&
    dist(L.ThumbTip, L.IndexMcp) > 0.7 * palm;
  if (!thumbExtended) return false;

  const dx = x(L.ThumbTip) - x(L.ThumbMcp);
  const dy = y(L.ThumbTip) - y(L.ThumbMcp);
  const len = Math.hypot(dx, dy);
  const pointsUp = len > 0 && -dy / len > Math.cos((40 * Math.PI) / 180);
  if (!pointsUp) return false;

  const tipY = y(L.ThumbTip);
  const margin = 0.1 * palm;
  for (let i = 0; i < 21; i++) {
    if (i !== L.ThumbTip && y(i) < tipY + margin) return false;
  }
  return true;
}
