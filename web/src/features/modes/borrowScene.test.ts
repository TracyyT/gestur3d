import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialScene } from '@/core/interaction/sceneModel';
import { useScene } from '@/stores/scene';
import { borrowScene } from './borrowScene';

const kinds = () => useScene.getState().objects.map((o) => o.kind);

describe('borrowScene', () => {
  beforeEach(() => useScene.setState({ ...createInitialScene(), undoStack: [] }));

  it('restores the original scene when released', () => {
    useScene.getState().dispatch({ type: 'add', kind: 'ring' }, 'ui');
    const release = borrowScene();
    useScene.setState({ objects: [] });
    release();
    expect(kinds()).toEqual(['sphere', 'cube', 'sculpture', 'ring']);
    expect(useScene.getState().undoStack).toHaveLength(1);
  });

  it('a second borrow before the first is released keeps the first snapshot', () => {
    const first = borrowScene();
    useScene.setState({ objects: [] }); // the lesson's scene
    const second = borrowScene();
    first();
    expect(kinds()).toEqual([]); // still borrowed
    second();
    expect(kinds()).toEqual(['sphere', 'cube', 'sculpture']);
  });

  it('releasing twice does nothing more', () => {
    const release = borrowScene();
    release();
    useScene.setState({ objects: [] });
    release();
    expect(kinds()).toEqual([]);
  });
});
