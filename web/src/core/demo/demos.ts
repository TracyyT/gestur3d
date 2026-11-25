import type { TaskId } from '@/core/practice/tasks';
import { scriptedRecording, type Keyframe } from '@/core/tracking/scripts';
import type { Recording } from '@/core/vision/recording';

/**
 * Demo motions for each Practice task. Coordinates are raw camera space:
 * the view is mirrored, so a smaller cx is further right on screen. The
 * right hand sits at cx ≈ 0.4 (screen right), the left at cx ≈ 0.6.
 */

/** Two recordings of the same length and rate, as one with both hands. */
export function mergeRecordings(a: Recording, b: Recording, label: string): Recording {
  const n = Math.max(a.frames.length, b.frames.length);
  const at = (r: Recording, i: number) => r.frames[Math.min(i, r.frames.length - 1)]!;
  return {
    ...a,
    label,
    frames: Array.from({ length: n }, (_, i) => {
      const fa = at(a, i);
      return { ...fa, hands: [...fa.hands, ...at(b, i).hands] };
    }),
  };
}

const one = (keys: Keyframe[], label: string) =>
  scriptedRecording(keys, { handedness: 'Right', label: `demo: ${label}` });

const two = (right: Keyframe[], left: Keyframe[], label: string) =>
  mergeRecordings(
    scriptedRecording(right, { handedness: 'Right' }),
    scriptedRecording(left, { handedness: 'Left' }),
    `demo: ${label}`,
  );

/** Keyframes for a hand that holds still (optionally pinched) for `ms`. */
const hold = (cx: number, cy: number, pinch: number, ms: number, extra: Partial<Keyframe> = {}) => [
  { at: 0, cx, cy, pinch, ...extra },
  { at: ms, cx, cy, pinch, ...extra },
];

const BUILDERS: Record<TaskId, () => Recording> = {
  move: () =>
    one(
      [
        { at: 0, cx: 0.58, cy: 0.55, pinch: 0 },
        { at: 400, cx: 0.58, cy: 0.55, pinch: 1 },
        { at: 1300, cx: 0.42, cy: 0.48, pinch: 1 },
        { at: 1700, cx: 0.42, cy: 0.48, pinch: 0 },
      ],
      'grab and move',
    ),
  resize: () =>
    two(
      [
        { at: 0, cx: 0.45, cy: 0.5, pinch: 1 },
        { at: 500, cx: 0.45, cy: 0.5, pinch: 1 },
        { at: 1500, cx: 0.33, cy: 0.5, pinch: 1 },
        { at: 1800, cx: 0.33, cy: 0.5, pinch: 1 },
      ],
      [
        { at: 0, cx: 0.55, cy: 0.5, pinch: 0 },
        { at: 500, cx: 0.55, cy: 0.5, pinch: 1 },
        { at: 1500, cx: 0.67, cy: 0.5, pinch: 1 },
        { at: 1800, cx: 0.67, cy: 0.5, pinch: 1 },
      ],
      'resize',
    ),
  rotate: () => {
    // Both hands pinched, turning about the middle like a steering wheel.
    const keys = (side: 1 | -1): Keyframe[] =>
      Array.from({ length: 7 }, (_, i) => {
        const a = (i / 6) * (Math.PI / 3); // 0 → 60°
        return {
          at: 300 + i * 220,
          cx: 0.5 + side * 0.11 * Math.cos(a),
          cy: 0.5 + side * 0.11 * Math.sin(a),
          pinch: 1,
        };
      });
    const r = keys(-1);
    const l = keys(1);
    return two([{ ...r[0]!, at: 0 }, ...r], [{ ...l[0]!, at: 0 }, ...l], 'rotate');
  },
  depth: () =>
    two(
      hold(0.42, 0.52, 1, 2000),
      [
        { at: 0, cx: 0.56, cy: 0.48, pinch: 0, size: 0.12 },
        { at: 500, cx: 0.56, cy: 0.48, pinch: 0, size: 0.12 },
        { at: 1300, cx: 0.56, cy: 0.48, pinch: 0, size: 0.17 },
        { at: 2000, cx: 0.56, cy: 0.48, pinch: 0, size: 0.17 },
      ],
      'push and pull',
    ),
  menu: () =>
    one(
      [
        { at: 0, cx: 0.5, cy: 0.58, pinch: 0 },
        { at: 400, cx: 0.5, cy: 0.52, pinch: 0, point: true },
        { at: 1600, cx: 0.5, cy: 0.52, pinch: 0, point: true },
      ],
      'open the menu',
    ),
  add: () =>
    one(
      [
        { at: 0, cx: 0.5, cy: 0.52, pinch: 0, point: true },
        { at: 600, cx: 0.44, cy: 0.42, pinch: 0, point: true },
        { at: 1100, cx: 0.38, cy: 0.36, pinch: 0, point: true },
        { at: 1300, cx: 0.38, cy: 0.36, pinch: 1 },
        { at: 1600, cx: 0.38, cy: 0.36, pinch: 0 },
      ],
      'add a shape',
    ),
  draw: () =>
    one(
      [
        { at: 0, cx: 0.62, cy: 0.5, pinch: 0 },
        { at: 300, cx: 0.62, cy: 0.5, pinch: 1 },
        ...Array.from({ length: 8 }, (_, i) => ({
          at: 400 + i * 160,
          cx: 0.62 - (i + 1) * 0.03,
          cy: 0.5 + 0.05 * Math.sin((i + 1) * 1.2),
          pinch: 1,
        })),
        { at: 1800, cx: 0.38, cy: 0.5, pinch: 0 },
      ],
      'draw',
    ),
};

const cache = new Map<TaskId, Recording>();

/** The demo recording for a task (built once). */
export function demoFor(id: TaskId): Recording {
  let r = cache.get(id);
  if (!r) cache.set(id, (r = BUILDERS[id]()));
  return r;
}
