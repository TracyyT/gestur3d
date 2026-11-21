import { describe, expect, it } from 'vitest';
import {
  quatAngleBetween,
  quatFromAxisAngle,
  quatFromEuler,
  quatMultiply,
  quatNormalize,
  quatRotateVec3,
  type Quat,
} from './quat';

const close = (a: readonly number[], b: readonly number[], digits = 9) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, digits));

describe('quat', () => {
  it('rotates a vector about an axis', () => {
    const q = quatFromAxisAngle([0, 0, 1], Math.PI / 2);
    close(quatRotateVec3(q, [1, 0, 0]), [0, 1, 0]);
  });

  it('multiplies right to left (b first, then a)', () => {
    const a = quatFromAxisAngle([0, 1, 0], Math.PI / 2);
    const b = quatFromAxisAngle([1, 0, 0], Math.PI / 2);
    const v: [number, number, number] = [0, 1, 0];
    close(quatRotateVec3(quatMultiply(a, b), v), quatRotateVec3(a, quatRotateVec3(b, v)));
  });

  it('matches Three.js XYZ Euler order', () => {
    // XYZ order = Rx · Ry · Rz applied to the vector (z first).
    const [x, y, z] = [0.3, -0.8, 1.1];
    const expected = quatMultiply(
      quatFromAxisAngle([1, 0, 0], x),
      quatMultiply(quatFromAxisAngle([0, 1, 0], y), quatFromAxisAngle([0, 0, 1], z)),
    );
    close(quatFromEuler([x, y, z]), expected);
  });

  it('normalizes and falls back to identity on garbage', () => {
    close(quatNormalize([0, 0, 0, 2]), [0, 0, 0, 1]);
    expect(quatNormalize([0, 0, 0, 0])).toEqual([0, 0, 0, 1]);
    expect(quatNormalize([NaN, 0, 0, 1])).toEqual([0, 0, 0, 1]);
    expect(quatFromAxisAngle([0, 0, 0], 1)).toEqual([0, 0, 0, 1]);
  });

  it('measures the angle between rotations, ignoring sign', () => {
    const q = quatFromAxisAngle([0, 1, 0], 0.4);
    const neg = q.map((v) => -v) as Quat;
    expect(quatAngleBetween(q, neg)).toBeCloseTo(0);
    expect(quatAngleBetween([0, 0, 0, 1], q)).toBeCloseTo(0.4);
  });
});
