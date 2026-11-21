/**
 * Minimal quaternion helpers for the framework-free core. Quaternions are
 * [x, y, z, w] tuples, the same layout Three.js uses, so the 3D layer can copy
 * them straight in. Every function returns a new tuple.
 */
import type { Vec3 } from '@/core/interaction/commands';

export type Quat = [number, number, number, number];

export const QUAT_IDENTITY: Readonly<Quat> = [0, 0, 0, 1];

export function quatNormalize([x, y, z, w]: Readonly<Quat>): Quat {
  const len = Math.hypot(x, y, z, w);
  if (!(len > 1e-12) || !Number.isFinite(len)) return [0, 0, 0, 1];
  return [x / len, y / len, z / len, w / len];
}

/** a · b: apply b first, then a. */
export function quatMultiply(a: Readonly<Quat>, b: Readonly<Quat>): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

/** Rotation of `angle` radians about a (not necessarily unit) axis. */
export function quatFromAxisAngle(axis: Readonly<Vec3>, angle: number): Quat {
  const len = Math.hypot(axis[0], axis[1], axis[2]);
  if (!(len > 1e-12)) return [0, 0, 0, 1];
  const s = Math.sin(angle / 2) / len;
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

/** Same convention as Three.js `Euler` with order 'XYZ'. */
export function quatFromEuler([x, y, z]: Readonly<Vec3>): Quat {
  const c1 = Math.cos(x / 2),
    c2 = Math.cos(y / 2),
    c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2),
    s2 = Math.sin(y / 2),
    s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  ];
}

/** Rotate vector v by unit quaternion q. */
export function quatRotateVec3(q: Readonly<Quat>, v: Readonly<Vec3>): Vec3 {
  const [qx, qy, qz, qw] = q;
  const [vx, vy, vz] = v;
  // t = 2 * cross(q.xyz, v); v' = v + w * t + cross(q.xyz, t)
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

/** Angle in radians between two rotations, in [0, π]. */
export function quatAngleBetween(a: Readonly<Quat>, b: Readonly<Quat>): number {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, d));
}
