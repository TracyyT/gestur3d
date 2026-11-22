import { HandLandmark as L } from '@/core/vision/types';

/**
 * Pointing: the index finger extended and the middle, ring and pinky fingers
 * curled (world landmarks, so it works however the hand is turned). It opens
 * the radial menu when held still; the thumb can be anywhere.
 */
export function isPointing(world: ArrayLike<number>): boolean {
  const d = (a: number, b: number) =>
    Math.hypot(
      world[a * 3]! - world[b * 3]!,
      world[a * 3 + 1]! - world[b * 3 + 1]!,
      world[a * 3 + 2]! - world[b * 3 + 2]!,
    );
  if (!(d(L.Wrist, L.MiddleMcp) > 1e-6)) return false;
  if (!(d(L.IndexTip, L.Wrist) > 1.15 * d(L.IndexPip, L.Wrist))) return false;
  return (
    [
      [L.MiddlePip, L.MiddleTip],
      [L.RingPip, L.RingTip],
      [L.PinkyPip, L.PinkyTip],
    ] as const
  ).every(([pip, tip]) => d(tip, L.Wrist) < d(pip, L.Wrist));
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

/**
 * A plain open hand: all four fingers extended and the palm turned toward the
 * camera (within 50°, either side). Used while the other hand holds an
 * object, where an open hand over the object sets its depth.
 */
export function isOpenHand(world: ArrayLike<number>): boolean {
  const p = (i: number) => [world[i * 3]!, world[i * 3 + 1]!, world[i * 3 + 2]!] as const;
  const d = (a: number, b: number) => {
    const [ax, ay, az] = p(a);
    const [bx, by, bz] = p(b);
    return Math.hypot(ax - bx, ay - by, az - bz);
  };
  if (!(d(L.Wrist, L.MiddleMcp) > 1e-6)) return false;
  const [wx, wy, wz] = p(L.Wrist);
  const [ix, iy, iz] = p(L.IndexMcp);
  const [px, py, pz] = p(L.PinkyMcp);
  const u = [ix - wx, iy - wy, iz - wz];
  const v = [px - wx, py - wy, pz - wz];
  const n = [
    u[1]! * v[2]! - u[2]! * v[1]!,
    u[2]! * v[0]! - u[0]! * v[2]!,
    u[0]! * v[1]! - u[1]! * v[0]!,
  ];
  const nl = Math.hypot(n[0]!, n[1]!, n[2]!);
  if (!(nl > 0) || Math.abs(n[2]!) / nl < Math.cos((50 * Math.PI) / 180)) return false;
  return (
    [
      [L.IndexPip, L.IndexTip],
      [L.MiddlePip, L.MiddleTip],
      [L.RingPip, L.RingTip],
      [L.PinkyPip, L.PinkyTip],
    ] as const
  ).every(([pip, tip]) => d(tip, L.Wrist) > 1.1 * d(pip, L.Wrist));
}
