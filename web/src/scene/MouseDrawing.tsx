import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { StrokeBuilder } from '@/core/drawing/strokeBuilder';
import type { Vec3 } from '@/core/interaction/commands';
import { DRAW_PLANE_ORIGIN, drawRuntime, useDraw } from '@/features/drawing/drawStore';
import { useMenu } from '@/features/menu/menuStore';
import { useScene } from '@/stores/scene';
import { useSettings } from '@/stores/settings';
import { objectRegistry } from './objectRegistry';

/** drawRuntime.live key for the mouse's stroke (hand ids are >= 0). */
const MOUSE_PEN = -1;

/**
 * With the Draw tool on, dragging empty space with the mouse draws (orbiting
 * is off). Dragging an object still moves it.
 */
export function MouseDrawing() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const plane = new Plane();
    const v = new Vector3();
    const n = new Vector3();
    let stroke: StrokeBuilder | null = null;
    let pointerId = -1;

    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const worldAt = (): Vec3 | null => {
      camera.getWorldDirection(n).negate();
      plane.setFromNormalAndCoplanarPoint(n, v.fromArray(DRAW_PLANE_ORIGIN));
      const hit = raycaster.ray.intersectPlane(plane, v);
      return hit ? [hit.x, hit.y, hit.z] : null;
    };
    const publish = () => {
      if (stroke) drawRuntime.live.set(MOUSE_PEN, stroke.points);
      else drawRuntime.live.delete(MOUSE_PEN);
      drawRuntime.version++;
    };
    const add = (e: PointerEvent) => {
      const screen = local(e);
      const world = worldAt();
      if (stroke && world && stroke.add({ screen, world })) publish();
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0 || stroke) return;
      if (!useDraw.getState().active || useMenu.getState().open) return;
      if (!useSettings.getState().mouseKeyboardEnabled) return;
      local(e);
      if (raycaster.intersectObjects(objectRegistry.all(), false).length) return; // a grab
      stroke = new StrokeBuilder(performance.now());
      pointerId = e.pointerId;
      el.setPointerCapture(e.pointerId);
      add(e);
    };
    const move = (e: PointerEvent) => {
      if (stroke && e.pointerId === pointerId) add(e);
    };
    const up = (e: PointerEvent) => {
      if (!stroke || e.pointerId !== pointerId) return;
      add(e);
      const points = stroke.finish(performance.now());
      stroke = null;
      publish();
      if (points) {
        const color = useDraw.getState().color;
        useScene.getState().dispatch({ type: 'addStroke', points, color }, 'mouse');
      }
    };
    const cancel = (e: PointerEvent) => {
      if (!stroke || e.pointerId !== pointerId) return;
      stroke = null;
      publish();
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      drawRuntime.live.delete(MOUSE_PEN);
    };
  }, [gl, camera]);

  return null;
}
