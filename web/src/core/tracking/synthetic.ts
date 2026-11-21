import type { Handedness, TrackedHand } from '@/core/vision/types';

/**
 * Synthetic hand landmarks for tests and scripted replays. An open hand, palm
 * toward the camera, fingers up, with an adjustable pinch. Geometry is in
 * "palm units" (wrist → middle MCP = 1), y up = negative.
 */
type P = [number, number];

const OPEN: P[] = [
  [0, 0], // wrist
  [0.35, -0.2],
  [0.6, -0.45],
  [0.8, -0.7],
  [0.95, -0.95], // thumb
  [0.3, -1.0],
  [0.33, -1.45],
  [0.35, -1.75],
  [0.36, -2.0], // index
  [0, -1.0],
  [0, -1.5],
  [0, -1.85],
  [0, -2.1], // middle
  [-0.27, -0.95],
  [-0.3, -1.4],
  [-0.32, -1.7],
  [-0.33, -1.95], // ring
  [-0.5, -0.82],
  [-0.58, -1.15],
  [-0.62, -1.38],
  [-0.65, -1.58], // pinky
];

const lerp = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export interface SynthHandOptions {
  /** Wrist position, raw camera-normalized (unmirrored). */
  cx: number;
  cy: number;
  /** Palm length as a fraction of frame height (~0.12 at arm's length). */
  size?: number;
  /** 0 = open, 1 = thumb and index touching. */
  pinch?: number;
  handedness?: Handedness;
  /** Camera width / height. */
  aspect?: number;
  /** Fan the fingers apart by this many degrees (index to pinky), like a deliberate open palm. */
  spread?: number;
}

/** Build a TrackedHand. In the raw frame a right hand's thumb points to +x. */
export function synthHand({
  cx,
  cy,
  size = 0.12,
  pinch = 0,
  handedness = 'Right',
  aspect = 16 / 9,
  spread = 0,
}: SynthHandOptions): TrackedHand {
  const s = handedness === 'Right' ? 1 : -1;
  const pts = OPEN.map(([x, y]): P => [x * s, y]);
  if (spread) {
    // Index leans toward the thumb, pinky away, each by half the spread.
    const fan = (mcp: number, joints: number[], deg: number) => {
      const a = ((deg * Math.PI) / 180) * s;
      const [cx, cy] = pts[mcp]!;
      for (const j of joints) {
        const [x, y] = pts[j]!;
        pts[j] = [
          cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
          cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a),
        ];
      }
    };
    fan(5, [6, 7, 8], spread / 2);
    fan(17, [18, 19, 20], -spread / 2);
  }
  const meet: P = [0.55 * s, -1.25];
  pts[4] = lerp(pts[4]!, [meet[0] + 0.03 * s, meet[1] + 0.02], pinch);
  pts[3] = lerp(pts[3]!, lerp(pts[2]!, meet, 0.6), pinch);
  pts[8] = lerp(pts[8]!, [meet[0] - 0.03 * s, meet[1] - 0.02], pinch);
  pts[7] = lerp(pts[7]!, lerp(pts[6]!, meet, 0.7), pinch);

  const image = new Float32Array(63);
  const world = new Float32Array(63);
  pts.forEach(([x, y], i) => {
    image[i * 3] = cx + (x * size) / aspect;
    image[i * 3 + 1] = cy + y * size;
    image[i * 3 + 2] = 0;
    world[i * 3] = x * 0.085;
    world[i * 3 + 1] = y * 0.085;
    world[i * 3 + 2] = 0;
  });
  return { handedness, handednessScore: 0.98, image, world };
}
