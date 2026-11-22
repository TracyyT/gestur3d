import { create } from 'zustand';
import type { Command, InputSource, SceneModel } from '@/core/interaction/commands';
import { inverseOf, UNDO_LIMIT } from '@/core/interaction/history';
import { applyCommand, createInitialScene } from '@/core/interaction/sceneModel';

export type InteractionMode =
  'idle' | 'selecting' | 'moving' | 'rotating' | 'scaling' | 'twoHand' | 'depth';

interface SceneStore extends SceneModel {
  /** What the user is doing right now; shown in the HUD. */
  mode: InteractionMode;
  lastSource: InputSource | null;
  dispatch: (cmd: Command, source: InputSource) => void;
  /** Inverse commands of recent undoable steps, newest last. */
  undoStack: Command[];
  /** Undo the most recent add, remove or recolor. Returns false if there's nothing to undo. */
  undo: (source: InputSource) => boolean;
  setMode: (mode: InteractionMode, source?: InputSource) => void;
}

/** Scene state. Every change goes through dispatch → applyCommand. */
export const useScene = create<SceneStore>()((set, get) => ({
  ...createInitialScene(),
  mode: 'idle',
  lastSource: null,
  undoStack: [],
  dispatch: (cmd, source) => {
    const { objects, selectedId, nextId, undoStack } = get();
    const before = { objects, selectedId, nextId };
    const next = applyCommand(before, cmd);
    if (next.objects !== objects || next.selectedId !== selectedId || next.nextId !== nextId) {
      const inverse = next.objects !== objects ? inverseOf(before, cmd) : null;
      set({
        ...next,
        lastSource: source,
        // Reset starts a fresh history; undoable steps push their inverse.
        ...(cmd.type === 'reset'
          ? { undoStack: [] }
          : inverse
            ? { undoStack: [...undoStack, inverse].slice(-UNDO_LIMIT) }
            : {}),
      });
    }
  },
  undo: (source) => {
    const { objects, selectedId, nextId, undoStack } = get();
    const inverse = undoStack.at(-1);
    if (!inverse) return false;
    const next = applyCommand({ objects, selectedId, nextId }, inverse);
    set({ ...next, undoStack: undoStack.slice(0, -1), lastSource: source });
    return true;
  },
  setMode: (mode, source) => {
    if (get().mode !== mode) set({ mode, ...(source ? { lastSource: source } : {}) });
  },
}));
