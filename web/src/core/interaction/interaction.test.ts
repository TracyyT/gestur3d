import { describe, expect, it } from 'vitest';
import type { Vec3 } from './commands';
import { quatFromAxisAngle, quatRotateVec3 } from '@/core/math/quat';
import type { KeyInput } from './keyboard';
import { keyToCommand, MOVE_STEP } from './keyboard';
import {
  applyCommand,
  BOUNDS,
  createInitialScene,
  MAX_OBJECTS,
  objectLabel,
  SCALE_MAX,
  SCALE_MIN,
  spawnPosition,
} from './sceneModel';

const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ctrlKey: false,
  ...mods,
});

describe('applyCommand', () => {
  it('selects only existing objects', () => {
    const m = createInitialScene();
    expect(applyCommand(m, { type: 'select', id: 'obj-2' }).selectedId).toBe('obj-2');
    expect(applyCommand(m, { type: 'select', id: 'nope' })).toBe(m);
  });

  it('cycles selection in both directions with wraparound', () => {
    let m = createInitialScene();
    m = applyCommand(m, { type: 'cycleSelection', direction: 1 });
    expect(m.selectedId).toBe('obj-1');
    m = applyCommand(m, { type: 'cycleSelection', direction: -1 });
    expect(m.selectedId).toBe('obj-3');
  });

  it('clamps translation to the workspace bounds', () => {
    const m = applyCommand(createInitialScene(), {
      type: 'translate',
      id: 'obj-1',
      delta: [-100, 100, 0],
    });
    const p = m.objects[0]!.position;
    expect(p[0]).toBe(-BOUNDS.x);
    expect(p[1]).toBe(BOUNDS.yMax);
  });

  it('clamps scale and ignores invalid factors', () => {
    let m = createInitialScene();
    m = applyCommand(m, { type: 'scaleBy', id: 'obj-1', factor: 100 });
    expect(m.objects[0]!.scale).toBe(SCALE_MAX);
    m = applyCommand(m, { type: 'scaleBy', id: 'obj-1', factor: 0.0001 });
    expect(m.objects[0]!.scale).toBe(SCALE_MIN);
    expect(applyCommand(m, { type: 'scaleBy', id: 'obj-1', factor: NaN })).toBe(m);
    expect(applyCommand(m, { type: 'scaleBy', id: 'obj-1', factor: -2 })).toBe(m);
  });

  it('rotates about world axes and keeps the quaternion unit length', () => {
    let m = createInitialScene();
    m = applyCommand(m, { type: 'rotate', id: 'obj-1', delta: [0, Math.PI / 2, 0] });
    const q = m.objects[0]!.rotation;
    expect(q[1]).toBeCloseTo(Math.SQRT1_2);
    expect(q[3]).toBeCloseTo(Math.SQRT1_2);
    for (let i = 0; i < 1000; i++)
      m = applyCommand(m, { type: 'rotate', id: 'obj-1', delta: [0.01, 0.02, 0.03] });
    expect(Math.hypot(...m.objects[0]!.rotation)).toBeCloseTo(1, 10);
    expect(applyCommand(m, { type: 'rotate', id: 'obj-1', delta: [NaN, 0, 0] })).toBe(m);
  });

  it('a world-axis turn after a tilt still spins about world up', () => {
    let m = createInitialScene();
    m = applyCommand(m, { type: 'rotate', id: 'obj-1', delta: [0.5, 0, 0] });
    m = applyCommand(m, { type: 'rotate', id: 'obj-1', delta: [0, Math.PI, 0] });
    // Up stays up: a half turn about world Y keeps the tilted Y axis's height.
    const up = quatRotateVec3(m.objects[0]!.rotation, [0, 1, 0]);
    expect(up[1]).toBeCloseTo(Math.cos(0.5));
  });

  it('setTransform sets an absolute pose with the usual limits', () => {
    let m = createInitialScene();
    const rotation = quatFromAxisAngle([0, 0, 1], 0.7);
    m = applyCommand(m, {
      type: 'setTransform',
      id: 'obj-1',
      position: [1, 1, 1],
      rotation,
      scale: 2,
    });
    const o = m.objects[0]!;
    expect(o.position).toEqual([1, 1, 1]);
    expect(o.scale).toBe(2);
    o.rotation.forEach((v, i) => expect(v).toBeCloseTo(rotation[i]!));
    m = applyCommand(m, { type: 'setTransform', id: 'obj-1', position: [99, 99, 99], scale: 50 });
    expect(m.objects[0]!.position).toEqual([BOUNDS.x, BOUNDS.yMax, BOUNDS.z]);
    expect(m.objects[0]!.scale).toBe(SCALE_MAX);
    // Omitted parts are kept.
    m = applyCommand(m, { type: 'setTransform', id: 'obj-1', scale: 1 });
    expect(m.objects[0]!.position).toEqual([BOUNDS.x, BOUNDS.yMax, BOUNDS.z]);
  });

  it('setTransform ignores invalid values', () => {
    const m = createInitialScene();
    expect(applyCommand(m, { type: 'setTransform', id: 'obj-1', scale: 0 })).toBe(m);
    expect(applyCommand(m, { type: 'setTransform', id: 'obj-1', position: [NaN, 0, 0] })).toBe(m);
    expect(
      applyCommand(m, { type: 'setTransform', id: 'obj-1', rotation: [0, 0, Infinity, 1] }),
    ).toBe(m);
    expect(applyCommand(m, { type: 'setTransform', id: 'nope', scale: 2 })).toBe(m);
  });

  it('adds with unique ids, selects the new object and respects the cap', () => {
    let m = createInitialScene();
    m = applyCommand(m, { type: 'add', kind: 'cube' });
    expect(m.objects.at(-1)!.id).toBe('obj-4');
    expect(m.selectedId).toBe('obj-4');
    for (let i = 0; i < 40; i++) m = applyCommand(m, { type: 'add', kind: 'sphere' });
    expect(m.objects).toHaveLength(MAX_OBJECTS);
  });

  it('removing the selected object clears selection', () => {
    let m = applyCommand(createInitialScene(), { type: 'select', id: 'obj-2' });
    m = applyCommand(m, { type: 'remove', id: 'obj-2' });
    expect(m.objects.map((o) => o.id)).toEqual(['obj-1', 'obj-3']);
    expect(m.selectedId).toBeNull();
  });

  it('labels objects by kind, numbering duplicates', () => {
    let m = createInitialScene();
    expect(objectLabel(m, 'obj-2')).toBe('Cube');
    m = applyCommand(m, { type: 'add', kind: 'cube' });
    expect(objectLabel(m, 'obj-4')).toBe('Cube 2');
  });
});

describe('keyToCommand', () => {
  it('ignores keys when nothing is selected, except nothing for Esc', () => {
    expect(keyToCommand(key('ArrowLeft'), null)).toBeNull();
    expect(keyToCommand(key('Escape'), null)).toBeNull();
  });

  it('maps arrows to translation, Shift+Up/Down to depth', () => {
    expect(keyToCommand(key('ArrowLeft'), 'a')).toEqual({
      type: 'translate',
      id: 'a',
      delta: [-MOVE_STEP, 0, 0],
    });
    expect(keyToCommand(key('ArrowUp', { shiftKey: true }), 'a')).toEqual({
      type: 'translate',
      id: 'a',
      delta: [0, 0, -MOVE_STEP],
    });
  });

  it('maps rotate, scale, delete and escape', () => {
    expect(keyToCommand(key('q'), 'a')?.type).toBe('rotate');
    expect(keyToCommand(key('='), 'a')).toMatchObject({ type: 'scaleBy', factor: 1.1 });
    expect(keyToCommand(key('Delete'), 'a')).toEqual({ type: 'remove', id: 'a' });
    expect(keyToCommand(key('Escape'), 'a')).toEqual({ type: 'select', id: null });
  });

  it('leaves browser shortcuts alone', () => {
    expect(keyToCommand(key('e', { metaKey: true }), 'a')).toBeNull();
  });
});

describe('spawnPosition', () => {
  const gap = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  it('puts new objects where they do not overlap existing ones', () => {
    let m = createInitialScene();
    for (let i = 0; i < 6; i++) m = applyCommand(m, { type: 'add', kind: 'cube' });
    for (let i = 0; i < m.objects.length; i++)
      for (let j = i + 1; j < m.objects.length; j++)
        expect(gap(m.objects[i]!.position, m.objects[j]!.position)).toBeGreaterThan(1.3);
  });

  it('gives bigger objects more room', () => {
    let m = createInitialScene();
    m = applyCommand(m, { type: 'scaleBy', id: 'obj-2', factor: 3 });
    const p = spawnPosition(m);
    const cube = m.objects.find((o) => o.id === 'obj-2')!;
    expect(gap(p, cube.position)).toBeGreaterThan(0.7 * 4);
  });

  it('still finds a spot inside the bounds when the scene is crowded', () => {
    let m = createInitialScene();
    for (let i = 0; i < 40; i++) m = applyCommand(m, { type: 'add', kind: 'sphere' });
    const p = spawnPosition(m);
    expect(Math.abs(p[0])).toBeLessThanOrEqual(BOUNDS.x);
    expect(p.every(Number.isFinite)).toBe(true);
  });
});
