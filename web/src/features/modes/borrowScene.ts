import { useScene } from '@/stores/scene';

type Saved = Pick<
  ReturnType<typeof useScene.getState>,
  'objects' | 'selectedId' | 'nextId' | 'undoStack'
>;

let holders = 0;
let saved: Saved | null = null;

/**
 * Set the current scene aside while a mode uses its own (Practice, levels),
 * and put it back when the last borrower lets go. Counted, so a page that
 * mounts twice, or mounts before the previous instance unmounts, still
 * restores the scene that was there before the first borrow.
 */
export function borrowScene(): () => void {
  if (holders++ === 0) {
    const { objects, selectedId, nextId, undoStack } = useScene.getState();
    saved = { objects, selectedId, nextId, undoStack };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--holders === 0 && saved) {
      useScene.setState({ ...saved, mode: 'idle' });
      saved = null;
    }
  };
}
