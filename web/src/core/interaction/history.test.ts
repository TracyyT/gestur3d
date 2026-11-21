import { describe, expect, it } from 'vitest';
import type { Command, SceneModel } from './commands';
import { inverseOf } from './history';
import { applyCommand, createInitialScene } from './sceneModel';

/** Apply `cmd`, then its inverse; the scene should be back where it started. */
function roundTrip(model: SceneModel, cmd: Command) {
  const inverse = inverseOf(model, cmd);
  expect(inverse).not.toBeNull();
  return applyCommand(applyCommand(model, cmd), inverse!);
}

describe('undo history', () => {
  it('undoes an add', () => {
    const m = createInitialScene();
    const back = roundTrip(m, { type: 'add', kind: 'helix' });
    expect(back.objects).toEqual(m.objects);
  });

  it('undoes a remove, back in the same place in the list and still selected', () => {
    let m = createInitialScene();
    m = applyCommand(m, { type: 'select', id: 'obj-2' });
    m = applyCommand(m, { type: 'setColor', id: 'obj-2', color: 'white' });
    const back = roundTrip(m, { type: 'remove', id: 'obj-2' });
    expect(back.objects).toEqual(m.objects);
    expect(back.selectedId).toBe('obj-2');
  });

  it('undoes a recolor, including back to the default colors', () => {
    let m = createInitialScene();
    expect(roundTrip(m, { type: 'setColor', id: 'obj-1', color: 'violet' }).objects).toEqual(
      m.objects,
    );
    m = applyCommand(m, { type: 'setColor', id: 'obj-1', color: 'violet' });
    expect(roundTrip(m, { type: 'setColor', id: 'obj-1', color: null }).objects[0]!.color).toBe(
      'violet',
    );
  });

  it('ignores moves and selection, and unknown ids', () => {
    const m = createInitialScene();
    expect(inverseOf(m, { type: 'translate', id: 'obj-1', delta: [1, 0, 0] })).toBeNull();
    expect(inverseOf(m, { type: 'select', id: 'obj-1' })).toBeNull();
    expect(inverseOf(m, { type: 'remove', id: 'nope' })).toBeNull();
  });

  it('restore does nothing if the object is already there', () => {
    const m = createInitialScene();
    expect(
      applyCommand(m, { type: 'restore', object: m.objects[0]!, index: 0, selected: false }),
    ).toBe(m);
  });
});
