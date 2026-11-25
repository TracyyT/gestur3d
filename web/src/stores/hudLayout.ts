import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface HudLayoutState {
  /** Camera preview top-left corner, px from the viewport's top-left. null = default spot. */
  previewPos: { x: number; y: number } | null;
  previewCollapsed: boolean;
  panelsVisible: boolean;
  /** Width a mode's own left panel covers (px), so the scene frames beside it. Not saved. */
  leftInset: number;
  setPreviewPos: (pos: { x: number; y: number } | null) => void;
  setPreviewCollapsed: (v: boolean) => void;
  setPanelsVisible: (v: boolean) => void;
  setLeftInset: (px: number) => void;
}

/** Where the user put HUD pieces. Persisted so the workspace feels like theirs. */
export const useHudLayout = create<HudLayoutState>()(
  persist(
    (set) => ({
      previewPos: null,
      previewCollapsed: false,
      panelsVisible: true,
      leftInset: 0,
      setPreviewPos: (previewPos) => set({ previewPos }),
      setPreviewCollapsed: (previewCollapsed) => set({ previewCollapsed }),
      setPanelsVisible: (panelsVisible) => set({ panelsVisible }),
      setLeftInset: (leftInset) => set({ leftInset }),
    }),
    {
      name: 'gestur3d.hud',
      version: 1,
      partialize: ({ previewPos, previewCollapsed, panelsVisible }) => ({
        previewPos,
        previewCollapsed,
        panelsVisible,
      }),
    },
  ),
);

/** Keep a box of size w×h fully inside a viewport of size vw×vh with a margin. */
export function clampToViewport(
  pos: { x: number; y: number },
  size: { w: number; h: number },
  viewport: { w: number; h: number },
  margin = 12,
  top = margin,
) {
  return {
    x: Math.min(Math.max(margin, pos.x), Math.max(margin, viewport.w - size.w - margin)),
    y: Math.min(Math.max(top, pos.y), Math.max(top, viewport.h - size.h - margin)),
  };
}
