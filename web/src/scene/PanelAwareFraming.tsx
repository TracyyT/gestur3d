import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { PerspectiveCamera } from 'three';
import { useHudLayout } from '@/stores/hudLayout';
import { computeFraming, type Framing } from './framing';

/**
 * Applies `computeFraming` by shifting the camera's projection
 * (`setViewOffset`) and its zoom. The camera's position and orbit target never
 * change, and pointer picking stays accurate because raycasting uses the same
 * projection matrix. Eases between states, or snaps under reduced motion.
 */
export function PanelAwareFraming({ instant }: { instant: boolean }) {
  const panelsVisible = useHudLayout((s) => s.panelsVisible);
  const leftInset = useHudLayout((s) => s.leftInset);
  const state = useRef<Framing>({ offsetX: 0, zoom: 1 });

  useFrame(({ camera, size }, delta) => {
    const cam = camera as PerspectiveCamera;
    const target = computeFraming(panelsVisible, size.width, size.height, leftInset);
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
