import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  MeshBasicMaterial,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { Vec3 } from '@/core/interaction/commands';

/** Tube radius in world units (scales with the object). */
export const STROKE_RADIUS = 0.022;
/** Pick volume padding around a stroke's bounding box, world units. */
const PICK_PAD = 0.12;

/**
 * Geometry for one stroke: a thin glowing tube through its points, and an
 * invisible box around it that hands and the mouse pick (thin lines are hard
 * to hit). A tube, not a screen-space line, so it has real thickness in 3D
 * and renders the same on every GPU.
 */
export function strokeGeometry(points: Vec3[]): { tube: BufferGeometry; pick: BufferGeometry } {
  const tube = tubeThrough(points);
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of points)
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i]!, p[i]!);
      hi[i] = Math.max(hi[i]!, p[i]!);
    }
  const size = [0, 1, 2].map((i) => hi[i]! - lo[i]! + 2 * PICK_PAD) as Vec3;
  const pick = new BoxGeometry(...size).translate(
    (lo[0]! + hi[0]!) / 2,
    (lo[1]! + hi[1]!) / 2,
    (lo[2]! + hi[2]!) / 2,
  );
  return { tube, pick };
}

/** A tube through the points (already smoothed: the curve just connects them). */
export function tubeThrough(points: Vec3[], radius = STROKE_RADIUS): BufferGeometry {
  const curve = new CatmullRomCurve3(
    points.map((p) => new Vector3(...p)),
    false,
    'catmullrom',
    0,
  );
  return new TubeGeometry(curve, Math.max(2, points.length * 2), radius, 6, false);
}

/** Bright enough to pass the bloom threshold, so the stroke glows. */
export function createStrokeMaterial(color: string) {
  return new MeshBasicMaterial({
    color: new Color(color).multiplyScalar(1.8),
    transparent: true,
    opacity: 0.9,
    toneMapped: false,
    depthWrite: false,
  });
}

/** Never drawn, still hit by raycasts. */
export function createPickMaterial() {
  return new MeshBasicMaterial({ visible: false });
}
