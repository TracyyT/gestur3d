/**
 * Commands are the only way to change the scene. Mouse, keyboard, gestures
 * (M2+) and replayed recordings all produce the same commands, so every input
 * path shares one tested reducer.
 */
import type { Quat } from '@/core/math/quat';

export type Vec3 = [number, number, number];

export type ObjectKind =
  | 'sphere'
  | 'cube'
  | 'sculpture'
  | 'ring'
  | 'pyramid'
  | 'crystal'
  | 'capsule'
  | 'helix'
  | 'gyroscope';

/** Color choices for an object (otherwise its kind's own colors). */
export type HoloColor = 'cyan' | 'violet' | 'white';

export type InputSource = 'mouse' | 'keyboard' | 'gesture' | 'replay' | 'ui';

export type Command =
  | { type: 'select'; id: string | null }
  | { type: 'cycleSelection'; direction: 1 | -1 }
  | { type: 'setPosition'; id: string; position: Vec3 }
  | { type: 'translate'; id: string; delta: Vec3 }
  /** Turn by Euler XYZ angles (radians) about the world axes. */
  | { type: 'rotate'; id: string; delta: Vec3 }
  /** Absolute pose, e.g. from a two-hand grab. Omitted parts stay as they are. */
  | { type: 'setTransform'; id: string; position?: Vec3; rotation?: Quat; scale?: number }
  | { type: 'scaleBy'; id: string; factor: number }
  /** null = back to the kind's own colors. */
  | { type: 'setColor'; id: string; color: HoloColor | null }
  | { type: 'add'; kind: ObjectKind }
  | { type: 'remove'; id: string }
  /** Put a removed object back where it was (used by Undo). */
  | { type: 'restore'; object: SceneObject; index: number; selected: boolean }
  | { type: 'reset' };

export interface SceneObject {
  id: string;
  kind: ObjectKind;
  position: Vec3;
  /** Unit quaternion [x, y, z, w]. */
  rotation: Quat;
  scale: number;
  /** Chosen color; absent = the kind's own colors. */
  color?: HoloColor;
}

export interface SceneModel {
  objects: SceneObject[];
  selectedId: string | null;
  /** Monotonic counter for new object ids. */
  nextId: number;
}
