import { QUAT_IDENTITY, quatFromEuler, quatMultiply, quatNormalize } from '@/core/math/quat';
import type { Command, ObjectKind, SceneModel, SceneObject, Vec3 } from './commands';

export const SCALE_MIN = 0.3;
export const SCALE_MAX = 3;
/** Objects stay inside this box so nothing can be flung out of reach. */
export const BOUNDS = { x: 4.5, yMin: -0.6, yMax: 3, z: 3.5 } as const;
export const MAX_OBJECTS = 24;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function clampPosition([x, y, z]: Vec3): Vec3 {
  return [
    clamp(x, -BOUNDS.x, BOUNDS.x),
    clamp(y, BOUNDS.yMin, BOUNDS.yMax),
    clamp(z, -BOUNDS.z, BOUNDS.z),
  ];
}

const clampScale = (s: number) => clamp(s, SCALE_MIN, SCALE_MAX);

export const KIND_LABEL: Record<ObjectKind, string> = {
  sphere: 'Sphere',
  cube: 'Cube',
  sculpture: 'Sculpture',
  ring: 'Ring',
  pyramid: 'Pyramid',
  crystal: 'Crystal',
  capsule: 'Capsule',
  helix: 'Helix',
  gyroscope: 'Gyroscope',
};

/** Every kind, in the order the add menus show them. */
export const OBJECT_KINDS = Object.keys(KIND_LABEL) as ObjectKind[];

export function createInitialScene(): SceneModel {
  const objects: SceneObject[] = [
    {
      id: 'obj-1',
      kind: 'sphere',
      position: [-1.9, 0.25, 0],
      rotation: [...QUAT_IDENTITY],
      scale: 1,
    },
    {
      id: 'obj-2',
      kind: 'cube',
      position: [0, 0.25, -0.4],
      rotation: quatFromEuler([0.35, 0.6, 0]),
      scale: 1,
    },
    {
      id: 'obj-3',
      kind: 'sculpture',
      position: [1.9, 0.25, 0],
      rotation: [...QUAT_IDENTITY],
      scale: 1,
    },
  ];
  return { objects, selectedId: null, nextId: 4 };
}

function update(model: SceneModel, id: string, fn: (o: SceneObject) => SceneObject): SceneModel {
  let changed = false;
  const objects = model.objects.map((o) => {
    if (o.id !== id) return o;
    changed = true;
    return fn(o);
  });
  return changed ? { ...model, objects } : model;
}

/** Rough radius of an object at scale 1, for spacing new objects. */
const OBJECT_RADIUS = 0.7;

/**
 * Candidate spawn points, best first: a row above the default objects, then
 * low in front of the gaps between them, then out to the left, then behind. Kept left of
 * x ≈ 2.4 on the right, where the side panels start covering the scene.
 */
const SPAWN_CANDIDATES: Vec3[] = [
  [0, 1.75, -0.6],
  [-1.75, 1.75, -0.6],
  [1.75, 1.75, -0.6],
  [-0.95, -0.35, 2.3],
  [0.95, -0.35, 2.3],
  [-3.3, 1.75, -0.6],
  [-2.85, -0.35, 2.3],
  [-3.7, 0.25, -0.6],
  [0, 0.25, -3],
  [-2.1, 0.25, -3],
  [2.1, 0.25, -3],
  [0, 2.9, -3],
];

/**
 * Spawn point for a new object: the first candidate with room around it, so
 * new objects don't land inside existing ones. If the scene is crowded, the
 * candidate farthest from everything.
 */
export function spawnPosition(model: SceneModel): Vec3 {
  const clearance = (p: Vec3) =>
    Math.min(
      Infinity,
      ...model.objects.map(
        (o) =>
          Math.hypot(p[0] - o.position[0], p[1] - o.position[1], p[2] - o.position[2]) -
          OBJECT_RADIUS * (1 + o.scale),
      ),
    );
  let best = SPAWN_CANDIDATES[0]!;
  let bestClear = -Infinity;
  for (const p of SPAWN_CANDIDATES) {
    const c = clearance(p);
    if (c >= 0) return clampPosition(p);
    if (c > bestClear) {
      bestClear = c;
      best = p;
    }
  }
  return clampPosition(best);
}

/** Pure scene reducer. Returns the same object when nothing changed. */
export function applyCommand(model: SceneModel, cmd: Command): SceneModel {
  switch (cmd.type) {
    case 'select': {
      if (cmd.id !== null && !model.objects.some((o) => o.id === cmd.id)) return model;
      return cmd.id === model.selectedId ? model : { ...model, selectedId: cmd.id };
    }
    case 'cycleSelection': {
      const n = model.objects.length;
      if (!n) return model;
      const i = model.objects.findIndex((o) => o.id === model.selectedId);
      const next = i === -1 ? (cmd.direction === 1 ? 0 : n - 1) : (i + cmd.direction + n) % n;
      return { ...model, selectedId: model.objects[next]!.id };
    }
    case 'setPosition':
      return update(model, cmd.id, (o) => ({ ...o, position: clampPosition(cmd.position) }));
    case 'translate':
      return update(model, cmd.id, (o) => ({
        ...o,
        position: clampPosition([
          o.position[0] + cmd.delta[0],
          o.position[1] + cmd.delta[1],
          o.position[2] + cmd.delta[2],
        ]),
      }));
    case 'rotate': {
      if (!cmd.delta.every(Number.isFinite)) return model;
      // World-axis turn: applied after the current rotation, so "rotate right"
      // always turns the object right on screen, however it is already tilted.
      const turn = quatFromEuler(cmd.delta);
      return update(model, cmd.id, (o) => ({
        ...o,
        rotation: quatNormalize(quatMultiply(turn, o.rotation)),
      }));
    }
    case 'setTransform': {
      const { position, rotation, scale } = cmd;
      if (position && !position.every(Number.isFinite)) return model;
      if (rotation && !rotation.every(Number.isFinite)) return model;
      if (scale !== undefined && !(scale > 0 && Number.isFinite(scale))) return model;
      return update(model, cmd.id, (o) => ({
        ...o,
        position: position ? clampPosition(position) : o.position,
        rotation: rotation ? quatNormalize(rotation) : o.rotation,
        scale: scale !== undefined ? clampScale(scale) : o.scale,
      }));
    }
    case 'scaleBy': {
      if (!(cmd.factor > 0) || !Number.isFinite(cmd.factor)) return model;
      return update(model, cmd.id, (o) => ({
        ...o,
        scale: clampScale(o.scale * cmd.factor),
      }));
    }
    case 'setColor': {
      const o = model.objects.find((x) => x.id === cmd.id);
      if (!o || (o.color ?? null) === cmd.color) return model;
      return update(model, cmd.id, (x) => {
        const { color: _old, ...rest } = x;
        return cmd.color ? { ...rest, color: cmd.color } : rest;
      });
    }
    case 'add': {
      if (model.objects.length >= MAX_OBJECTS) return model;
      const id = `obj-${model.nextId}`;
      const obj: SceneObject = {
        id,
        kind: cmd.kind,
        position: spawnPosition(model),
        rotation: [...QUAT_IDENTITY],
        scale: 1,
      };
      return { objects: [...model.objects, obj], selectedId: id, nextId: model.nextId + 1 };
    }
    case 'remove': {
      if (!model.objects.some((o) => o.id === cmd.id)) return model;
      return {
        ...model,
        objects: model.objects.filter((o) => o.id !== cmd.id),
        selectedId: model.selectedId === cmd.id ? null : model.selectedId,
      };
    }
    case 'reset':
      return createInitialScene();
  }
}

/** Human-readable name like "Cube 2", numbered per kind in scene order. */
export function objectLabel(model: SceneModel, id: string): string {
  const obj = model.objects.find((o) => o.id === id);
  if (!obj) return '';
  const sameKind = model.objects.filter((o) => o.kind === obj.kind);
  const n = sameKind.indexOf(obj) + 1;
  return sameKind.length > 1 ? `${KIND_LABEL[obj.kind]} ${n}` : KIND_LABEL[obj.kind];
}
