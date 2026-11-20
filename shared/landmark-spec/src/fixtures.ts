import type { Handedness, NormalizeOptions } from './normalize.ts';

export interface GoldenCase {
  name: string;
  handedness: Handedness;
  aspect: number;
  options: NormalizeOptions;
  input: number[];
}

/**
 * A plausible open right hand in raw frame coordinates (palm facing camera,
 * fingers up), built from simple geometry so cases are reproducible.
 */
export function syntheticOpenHand(cx = 0.5, cy = 0.7, size = 0.12): number[] {
  const pts: Array<[number, number, number]> = [[0, 0, 0]]; // wrist
  // Fingers: thumb, index, middle, ring, pinky. Base x offsets and lean angles.
  const fingers: Array<{ baseX: number; baseY: number; dx: number; len: number[] }> = [
    { baseX: -0.35, baseY: -0.25, dx: -0.35, len: [0.3, 0.3, 0.25, 0.22] },
    { baseX: -0.3, baseY: -1.0, dx: -0.08, len: [0, 0.4, 0.25, 0.2] },
    { baseX: 0, baseY: -1.0, dx: 0, len: [0, 0.45, 0.28, 0.22] },
    { baseX: 0.28, baseY: -0.95, dx: 0.06, len: [0, 0.4, 0.25, 0.2] },
    { baseX: 0.52, baseY: -0.82, dx: 0.14, len: [0, 0.32, 0.2, 0.17] },
  ];
  for (const [fi, f] of fingers.entries()) {
    let x = f.baseX;
    let y = f.baseY;
    let z = -0.02 * fi;
    if (fi === 0) {
      // thumb: CMC, MCP, IP, TIP
      for (const l of f.len) {
        x += f.dx * l * 2;
        y -= l * 0.6;
        z -= 0.01;
        pts.push([x, y, z]);
      }
    } else {
      pts.push([x, y, z]); // MCP
      for (const l of f.len.slice(1)) {
        x += f.dx * l;
        y -= l;
        z -= 0.008;
        pts.push([x, y, z]);
      }
    }
  }
  const aspect = 16 / 9;
  // Into raw normalized frame coords (x shrunk by aspect, as MediaPipe reports).
  return pts.flatMap(([x, y, z]) => [cx + (x * size) / aspect, cy + y * size, (z * size) / aspect]);
}

/** Mirror a raw hand horizontally in the frame (what the other hand looks like). */
export function mirrorRaw(raw: number[]): number[] {
  return raw.map((v, i) => (i % 3 === 0 ? 1 - v : v));
}

export function goldenCases(): GoldenCase[] {
  const open = syntheticOpenHand();
  return [
    { name: 'open-right-default', handedness: 'Right', aspect: 16 / 9, options: {}, input: open },
    {
      name: 'open-left-mirrored',
      handedness: 'Left',
      aspect: 16 / 9,
      options: {},
      input: mirrorRaw(open),
    },
    {
      name: 'open-left-no-mirror',
      handedness: 'Left',
      aspect: 16 / 9,
      options: { mirrorLeft: false },
      input: mirrorRaw(open),
    },
    {
      name: 'small-far-hand',
      handedness: 'Right',
      aspect: 16 / 9,
      options: {},
      input: syntheticOpenHand(0.2, 0.4, 0.05),
    },
    {
      name: 'aligned-rotation',
      handedness: 'Right',
      aspect: 16 / 9,
      options: { alignRotation: true },
      input: open,
    },
    { name: 'square-aspect', handedness: 'Right', aspect: 1, options: {}, input: open },
  ];
}
