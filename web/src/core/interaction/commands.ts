/**
 * Commands are the only way to change the scene. Mouse, keyboard, gestures
 * (M2+) and replayed recordings all produce the same commands, so every input
 * path shares one tested reducer.
 */
export type Vec3 = [number, number, number];

export type ObjectKind = 'sphere' | 'cube' | 'sculpture';

export type InputSource = 'mouse' | 'keyboard' | 'gesture' | 'replay' | 'ui';

export type Command =
  | { type: 'select'; id: string | null }
  | { type: 'cycleSelection'; direction: 1 | -1 }
  | { type: 'setPosition'; id: string; position: Vec3 }
  | { type: 'translate'; id: string; delta: Vec3 }
  | { type: 'rotate'; id: string; delta: Vec3 }
  | { type: 'scaleBy'; id: string; factor: number }
  | { type: 'add'; kind: ObjectKind }
  | { type: 'remove'; id: string }
  | { type: 'reset' };

export interface SceneObject {
  id: string;
  kind: ObjectKind;
  position: Vec3;
  /** Euler XYZ, radians. */
  rotation: Vec3;
  scale: number;
}

export interface SceneModel {
  objects: SceneObject[];
  selectedId: string | null;
  /** Monotonic counter for new object ids. */
  nextId: number;
}
