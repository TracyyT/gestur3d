import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { useHudLayout } from '@/stores/hudLayout';

/** Width the side panels cover on the right edge (296 px panel + 16 px margin). */
export const PANEL_COVER_PX = 312;
/** Below this width the panels overlay the scene anyway; don't reframe. */
const MIN_WIDTH_PX = 900;
/**
 * On-screen width the default object layout needs, as a multiple of the
 * viewport height (vertical FOV is fixed, so horizontal size scales with
 * height). Objects span about ±2.6 world units at ~7.7 units from the camera
 * with a 42° FOV: ≈ 0.88 × height, plus margin.
 */
const CONTENT_WIDTH_PER_HEIGHT = 1.0;
const MIN_ZOOM = 0.55;

export interface Framing {
  /** Horizontal projection shift in px (positive moves the scene left). */
  offsetX: number;
  /** Camera zoom (< 1 zooms out so the layout fits the free width). */
  zoom: number;
}

/**
 * Where the scene should sit: centered in the area left of the panels, and
 * zoomed out just enough for the default layout to fit. Pure for testing.
 */
export function computeFraming(panelsVisible: boolean, width: number, height: number): Framing {
  const reframe = panelsVisible && width >= MIN_WIDTH_PX;
  const free = reframe ? width - PANEL_COVER_PX : width;
  const needed = height * CONTENT_WIDTH_PER_HEIGHT;
  const zoom = Math.min(1, Math.max(MIN_ZOOM, free / needed));
  return { offsetX: reframe ? PANEL_COVER_PX / 2 : 0, zoom };
}

/**
 * Applies `computeFraming` by shifting the camera's projection
 * (`setViewOffset`) and its zoom. The camera's position and orbit target never
 * change, and pointer picking stays accurate because raycasting uses the same
 * projection matrix. Eases between states, or snaps under reduced motion.
 */
export function PanelAwareFraming({ instant }: { instant: boolean }) {
  const panelsVisible = useHudLayout((s) => s.panelsVisible);
  const state = useRef<Framing>({ offsetX: 0, zoom: 1 });

  useFrame(({ camera, size }, delta) => {
    const cam = camera as PerspectiveCamera;
    const target = computeFraming(panelsVisible, size.width, size.height);
    const k = instant ? 1 : Math.min(1, delta * 8);
    const ease = (from: number, to: number, eps: number) => {
      const v = from + (to - from) * k;
      return Math.abs(to - v) < eps ? to : v;
    };
    const next = {
      offsetX: ease(state.current.offsetX, target.offsetX, 0.25),
      zoom: ease(state.current.zoom, target.zoom, 0.0005),
    };
    state.current = next;

    const view = cam.view;
    const offsetChanged =
      next.offsetX === 0
        ? view?.enabled === true
        : !view?.enabled ||
          view.offsetX !== next.offsetX ||
          view.fullWidth !== size.width ||
          view.fullHeight !== size.height;
    const zoomChanged = cam.zoom !== next.zoom;
    if (!offsetChanged && !zoomChanged) return;

    cam.zoom = next.zoom;
    // Both calls update the projection matrix, which also applies the zoom.
    if (next.offsetX === 0) cam.clearViewOffset();
    else cam.setViewOffset(size.width, size.height, next.offsetX, 0, size.width, size.height);
  });

  return null;
}
