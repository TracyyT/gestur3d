import { create } from 'zustand';
import type { HoloColor, Vec3 } from '@/core/interaction/commands';

/** Where hand strokes are drawn: a camera-facing plane through this point. */
export const DRAW_PLANE_ORIGIN: Vec3 = [0, 0.9, 0.8];

interface DrawState {
  /** The Draw tool: pinching empty space draws. */
  active: boolean;
  color: HoloColor;
  setActive: (on: boolean) => void;
  toggle: () => void;
  setColor: (color: HoloColor) => void;
}

export const useDraw = create<DrawState>()((set) => ({
  active: false,
  color: 'cyan',
  setActive: (active) => set({ active }),
  toggle: () => set((s) => ({ active: !s.active })),
  setColor: (color) => set({ color }),
}));

/** Strokes being drawn right now (per hand), for the live trail. Mutable, per frame. */
export const drawRuntime = {
  live: new Map<number, Vec3[]>(),
  version: 0,
  /** Drop the hands' live strokes (the mouse's, keyed -1, stays). */
  resetHands() {
    for (const id of [...this.live.keys()]) if (id >= 0) this.live.delete(id);
    this.version++;
  },
};
