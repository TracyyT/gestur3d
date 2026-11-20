import { create } from 'zustand';
import type { Command, InputSource, SceneModel } from '@/core/interaction/commands';
import { applyCommand, createInitialScene } from '@/core/interaction/sceneModel';

export type InteractionMode = 'idle' | 'selecting' | 'moving' | 'rotating' | 'scaling';

interface SceneStore extends SceneModel {
  /** What the user is doing right now; shown in the HUD. */
  mode: InteractionMode;
  lastSource: InputSource | null;
  dispatch: (cmd: Command, source: InputSource) => void;
  setMode: (mode: InteractionMode, source?: InputSource) => void;
}

/** Scene state. Every change goes through dispatch → applyCommand. */
export const useScene = create<SceneStore>()((set, get) => ({
  ...createInitialScene(),
  mode: 'idle',
  lastSource: null,
  dispatch: (cmd, source) => {
    const { objects, selectedId, nextId } = get();
    const next = applyCommand({ objects, selectedId, nextId }, cmd);
    if (next.objects !== objects || next.selectedId !== selectedId || next.nextId !== nextId) {
      set({ ...next, lastSource: source });
    }
  },
  setMode: (mode, source) => {
    if (get().mode !== mode) set({ mode, ...(source ? { lastSource: source } : {}) });
  },
}));
