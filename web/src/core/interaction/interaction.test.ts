import { describe, expect, it } from 'vitest';
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

  it('wraps rotation into (-π, π]', () => {
    const m = applyCommand(createInitialScene(), {
      type: 'rotate',
      id: 'obj-1',
      delta: [0, 3 * Math.PI, 0],
    });
    expect(Math.abs(m.objects[0]!.rotation[1])).toBeCloseTo(Math.PI);
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
