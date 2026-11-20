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

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export const KIND_LABEL: Record<ObjectKind, string> = {
  sphere: 'Sphere',
  cube: 'Cube',
  sculpture: 'Sculpture',
};

export function createInitialScene(): SceneModel {
  const objects: SceneObject[] = [
    { id: 'obj-1', kind: 'sphere', position: [-1.9, 0.25, 0], rotation: [0, 0, 0], scale: 1 },
    { id: 'obj-2', kind: 'cube', position: [0, 0.25, -0.4], rotation: [0.35, 0.6, 0], scale: 1 },
    { id: 'obj-3', kind: 'sculpture', position: [1.9, 0.25, 0], rotation: [0, 0, 0], scale: 1 },
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

/** Spawn point for new objects: front and center, nudged so they don't stack exactly. */
function spawnPosition(model: SceneModel): Vec3 {
  const n = model.objects.length;
  return clampPosition([((n % 5) - 2) * 0.35, 0.5 + (n % 3) * 0.2, 0.6]);
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
    case 'rotate':
      return update(model, cmd.id, (o) => ({
        ...o,
        rotation: [
          wrapAngle(o.rotation[0] + cmd.delta[0]),
          wrapAngle(o.rotation[1] + cmd.delta[1]),
          wrapAngle(o.rotation[2] + cmd.delta[2]),
        ],
      }));
    case 'scaleBy': {
      if (!(cmd.factor > 0) || !Number.isFinite(cmd.factor)) return model;
      return update(model, cmd.id, (o) => ({
        ...o,
        scale: clamp(o.scale * cmd.factor, SCALE_MIN, SCALE_MAX),
      }));
    }
    case 'add': {
      if (model.objects.length >= MAX_OBJECTS) return model;
      const id = `obj-${model.nextId}`;
      const obj: SceneObject = {
        id,
        kind: cmd.kind,
        position: spawnPosition(model),
        rotation: [0, 0, 0],
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
