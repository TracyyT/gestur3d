/** Landmark spec v0 reference implementation. See ../SPEC.md. */

export const SPEC_VERSION = 'v0';
export const NUM_LANDMARKS = 21;
export const DIMS = 3;
export const FEATURE_LENGTH = NUM_LANDMARKS * DIMS;

const WRIST = 0;
const MIDDLE_MCP = 9;
const EPS = 1e-6;

export type Handedness = 'Left' | 'Right';

export interface NormalizeOptions {
  /** Mirror left hands so every hand looks like a right hand. Default true. */
  mirrorLeft?: boolean;
  /** Rotate so wrist→middle-MCP points up. Default false (keeps orientation cues). */
  alignRotation?: boolean;
}

/**
 * Normalize one hand's raw MediaPipe image landmarks (63 values, unmirrored
 * frame) into a translation-, scale- and handedness-invariant feature vector.
 * Returns null if the hand is degenerate (palm size ~ 0).
 */
export function normalizeHand(
  raw: ArrayLike<number>,
  handedness: Handedness,
  aspect: number,
  { mirrorLeft = true, alignRotation = false }: NormalizeOptions = {},
): Float32Array | null {
  if (raw.length !== FEATURE_LENGTH) {
    throw new Error(`expected ${FEATURE_LENGTH} values, got ${raw.length}`);
  }
  if (!(aspect > 0)) throw new Error(`aspect must be positive, got ${aspect}`);

  // Work in float64 for stability; emit float32.
  const p = new Float64Array(FEATURE_LENGTH);
  const wx = raw[WRIST * 3]! * aspect;
  const wy = raw[WRIST * 3 + 1]!;
  const wz = raw[WRIST * 3 + 2]! * aspect;
  const flip = mirrorLeft && handedness === 'Left' ? -1 : 1;

  for (let i = 0; i < NUM_LANDMARKS; i++) {
    p[i * 3] = (raw[i * 3]! * aspect - wx) * flip; // steps 1–3
    p[i * 3 + 1] = raw[i * 3 + 1]! - wy;
    p[i * 3 + 2] = raw[i * 3 + 2]! * aspect - wz;
  }

  const mx = p[MIDDLE_MCP * 3]!;
  const my = p[MIDDLE_MCP * 3 + 1]!;
  const palm = Math.hypot(mx, my); // step 4
  if (palm < EPS) return null;

  let cos = 1;
  let sin = 0;
  if (alignRotation) {
    // Rotate (mx, my) onto (0, -palm): angle = atan2 of target minus atan2 of source.
    const theta = Math.atan2(-1, 0) - Math.atan2(my, mx);
    cos = Math.cos(theta);
    sin = Math.sin(theta);
  }

  const out = new Float32Array(FEATURE_LENGTH);
  for (let i = 0; i < NUM_LANDMARKS; i++) {
    const x = p[i * 3]! / palm;
    const y = p[i * 3 + 1]! / palm;
    out[i * 3] = x * cos - y * sin;
    out[i * 3 + 1] = x * sin + y * cos;
    out[i * 3 + 2] = p[i * 3 + 2]! / palm;
  }
  return out;
}
