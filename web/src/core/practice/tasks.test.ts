import { describe, expect, it } from 'vitest';
import type { Command, InputSource, SceneModel } from '@/core/interaction/commands';
import { applyCommand, createInitialScene } from '@/core/interaction/sceneModel';
import { quatFromAxisAngle, quatMultiply } from '@/core/math/quat';
import { PracticeTracker, REQUIRED_TASKS, TASKS } from './tasks';

const CAMERA: [number, number, number] = [0, 2.3, 7.4];

function rig() {
  let scene: SceneModel = createInitialScene();
  const t = new PracticeTracker(scene, CAMERA);
  const run = (cmd: Command, source: InputSource = 'gesture') => {
    scene = applyCommand(scene, cmd);
    return t.command(cmd, source, scene);
  };
  const obj = (id = 'obj-1') => scene.objects.find((o) => o.id === id)!;
  return { t, run, obj };
}

describe('PracticeTracker', () => {
  it('ticks Grab and move after half a unit of sideways travel by hand', () => {
    const { t, run, obj } = rig();
    const [x, y, z] = obj().position;
    expect(run({ type: 'setPosition', id: 'obj-1', position: [x + 0.3, y, z] })).toEqual([]);
    expect(run({ type: 'setPosition', id: 'obj-1', position: [x + 0.3, y + 0.45, z] })).toEqual([
      'move',
    ]);
    expect(t.done.has('move')).toBe(true);
    // Only once.
    expect(run({ type: 'setPosition', id: 'obj-1', position: [x, y, z] })).toEqual([]);
  });

  it('mouse and keyboard moves do not count, and move the baseline', () => {
    const { t, run, obj } = rig();
    const [x, y, z] = obj().position;
    run({ type: 'setPosition', id: 'obj-1', position: [x + 2, y, z] }, 'mouse');
    expect(t.done.size).toBe(0);
    // A small hand move after the mouse drag is measured from the new spot.
    expect(run({ type: 'setPosition', id: 'obj-1', position: [x + 2.2, y, z] })).toEqual([]);
  });

  it('ticks resize at 1.3× either way', () => {
    const { run } = rig();
    expect(run({ type: 'scaleBy', id: 'obj-1', factor: 1.2 })).toEqual([]);
    expect(run({ type: 'scaleBy', id: 'obj-1', factor: 1.1 })).toEqual(['resize']);
    const shrink = rig();
    expect(shrink.run({ type: 'scaleBy', id: 'obj-2', factor: 0.75 })).toEqual(['resize']);
  });

  it('ticks rotate at 30° about any axis', () => {
    const { run, obj } = rig();
    const turn = (deg: number, axis: [number, number, number]) =>
      run({
        type: 'setTransform',
        id: 'obj-1',
        position: obj().position,
        rotation: quatMultiply(quatFromAxisAngle(axis, (deg * Math.PI) / 180), obj().rotation),
        scale: obj().scale,
      });
    expect(turn(20, [0, 0, 1])).toEqual([]);
    expect(turn(15, [0, 0, 1])).toEqual(['rotate']);
    const yaw = rig();
    expect(
      yaw.run({
        type: 'setTransform',
        id: 'obj-2',
        position: yaw.obj('obj-2').position,
        rotation: quatMultiply(quatFromAxisAngle([0, 1, 0], 0.6), yaw.obj('obj-2').rotation),
        scale: 1,
      }),
    ).toContain('rotate');
  });

  it('ticks push and pull on a change in distance to the camera, not sideways moves', () => {
    const { run, obj } = rig();
    const [x, y, z] = obj().position;
    expect(run({ type: 'setPosition', id: 'obj-1', position: [x, y, z + 0.4] })).toEqual([]);
    expect(run({ type: 'setPosition', id: 'obj-1', position: [x, y, z + 0.7] })).toEqual(['depth']);
  });

  it('ticks draw only for hand-drawn strokes', () => {
    const { run } = rig();
    const pts: [number, number, number][] = [
      [0, 1, 0],
      [1, 1, 0],
      [1, 2, 0],
    ];
    expect(run({ type: 'addStroke', points: pts }, 'mouse')).toEqual([]);
    expect(run({ type: 'addStroke', points: pts })).toEqual(['draw']);
  });

  it('ticks the menu only when a hand opens it, and Add only from a hand-opened menu', () => {
    const { t } = rig();
    expect(t.menuOpened('keyboard')).toEqual([]);
    expect(t.menuAction('add', 'keyboard')).toEqual([]);
    expect(t.menuOpened('hand')).toEqual(['menu']);
    expect(t.menuAction('color', 'hand')).toEqual([]);
    expect(t.menuAction('add', 'hand')).toEqual(['add']);
    expect(t.menuOpened('hand')).toEqual([]);
  });

  it('new objects get their own baseline', () => {
    const { run, obj } = rig();
    run({ type: 'add', kind: 'ring' }, 'ui');
    const ring = obj('obj-4');
    const [x, y, z] = ring.position;
    expect(run({ type: 'setPosition', id: 'obj-4', position: [x + 0.2, y, z] })).toEqual([]);
    expect(run({ type: 'setPosition', id: 'obj-4', position: [x + 0.6, y, z] })).toEqual(['move']);
  });

  it('only push and pull is optional', () => {
    expect(TASKS.filter((t) => t.optional).map((t) => t.id)).toEqual(['depth']);
    expect(REQUIRED_TASKS).toHaveLength(TASKS.length - 1);
  });
});
