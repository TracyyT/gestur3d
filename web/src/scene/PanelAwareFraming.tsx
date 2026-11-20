import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { useHudLayout } from '@/stores/hudLayout';

/** Width the side panels cover on the right edge (296 px panel + 16 px margin). */
export const PANEL_COVER_PX = 312;
/** Below this width the panels overlay the scene anyway; don't reframe. */
const MIN_WIDTH_PX = 900;

/**
 * Pixel offset that recenters the scene in the area left of the panels.
 * Pure so it can be unit-tested.
 */
export function framingOffset(panelsVisible: boolean, viewportWidth: number) {
  if (!panelsVisible || viewportWidth < MIN_WIDTH_PX) return 0;
  return PANEL_COVER_PX / 2;
}

/**
 * Shifts the camera's projection (not its position) so the scene centers in
 * the visible area when the side panels are open. Orbiting and pointer picking
 * stay correct because the raycaster uses the same projection matrix.
 */
export function PanelAwareFraming({ instant }: { instant: boolean }) {
  const panelsVisible = useHudLayout((s) => s.panelsVisible);
  const current = useRef(0);

  useFrame((state, delta) => {
    const camera = state.camera as PerspectiveCamera;
    const { width, height } = state.size;
    const target = framingOffset(panelsVisible, width);
    const prev = current.current;
    const next = instant ? target : prev + (target - prev) * Math.min(1, delta * 8);
    const settled = Math.abs(target - next) < 0.25 ? target : next;
    current.current = settled;

    const view = camera.view;
    const needsUpdate =
      settled === 0
        ? view?.enabled === true
        : !view?.enabled ||
          view.offsetX !== settled ||
          view.fullWidth !== width ||
          view.fullHeight !== height;
    if (!needsUpdate) return;

    if (settled === 0) camera.clearViewOffset();
    else camera.setViewOffset(width, height, settled, 0, width, height);
  });

  return null;
}
