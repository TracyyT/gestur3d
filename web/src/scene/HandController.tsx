import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { Vec3 } from '@/core/interaction/commands';
import {
  HandInteractionEngine,
  type PointerInput,
  type SceneQuery,
} from '@/core/interaction/handInteraction';
import { cameraToScreen, interactionBox, screenToNdc } from '@/core/interaction/handMapping';
import { HandTracker } from '@/core/tracking/handTracker';
import type { HandFrame } from '@/core/vision/types';
import { handRuntime } from '@/features/hands/handRuntime';
import { useHandTracking } from '@/features/hands/handTrackingStore';
import { useHudLayout } from '@/stores/hudLayout';
import { useScene } from '@/stores/scene';
import { useSettings } from '@/stores/settings';
import { visibleSceneRect } from './framing';
import { objectRegistry } from './objectRegistry';

/** Render-rate easing of the cursor between 30 Hz detections (ms time constant). */
const CURSOR_TAU_MS = 12;

/**
 * Runs the hand pipeline once per rendered frame:
 * new detections → tracker (smoothing, identity, pinch) → screen mapping →
 * interaction engine → scene commands. Raycasting uses the same camera and
 * projection as rendering, including the panel offset and zoom.
 */
export function HandController() {
  const source = useHandTracking((s) => s.source);
  const camera = useThree((s) => s.camera);
  const tracker = useMemo(() => new HandTracker(), []);
  const engine = useMemo(() => new HandInteractionEngine(), []);
  const queue = useRef<HandFrame[]>([]);
  const display = useRef(new Map<number, { x: number; y: number }>());
  const config = useRef('');
  const wasGrabbing = useRef(false);
  const sizeRef = useRef({ width: 1, height: 1 });
  const lastFrame = useRef({ wall: -Infinity, ts: 0 });

  const tools = useMemo(
    () => ({
      raycaster: new Raycaster(),
      ndc: new Vector2(),
      plane: new Plane(),
      v: new Vector3(),
      n: new Vector3(),
    }),
    [],
  );

  useEffect(() => {
    if (!source) return;
    const unsubscribe = source.subscribe((frame) => queue.current.push(frame));
    const shown = display.current;
    return () => {
      unsubscribe();
      queue.current = [];
      tracker.reset();
      engine.reset();
      shown.clear();
      handRuntime.reset();
    };
  }, [source, tracker, engine]);

  // Expose projection for the cursor overlay's tether line and test hooks.
  useEffect(() => {
    const v = new Vector3();
    handRuntime.project = (p) => {
      v.set(p[0], p[1], p[2]).project(camera);
      const size = sizeRef.current;
      return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
    };
    return () => {
      handRuntime.project = null;
    };
  }, [camera]);

  useFrame((state, delta) => {
    sizeRef.current = state.size;
    if (!source) return;
    const now = performance.now();
    const { size } = state;
    const settings = useSettings.getState();
    const key = `${settings.trackingSmoothing}|${settings.gestureSensitivity}`;
    if (key !== config.current) {
      tracker.configure({
        smoothing: settings.trackingSmoothing,
        sensitivity: settings.gestureSensitivity,
      });
      config.current = key;
    }

    const aspect = useHandTracking.getState().cameraAspect;
    // Several detections can land in one rendered frame (render hitch, slow
    // GPU). Pinch start/end edges from all of them must reach the engine.
    const edges = new Map<number, { started: boolean; ended: boolean }>();
    const batch = queue.current.splice(0);
    if (batch.length) {
      lastFrame.current = { wall: now, ts: batch.at(-1)!.timestamp };
    }
    for (const f of batch) {
      for (const t of tracker.update(f, aspect)) {
        const e = edges.get(t.id) ?? { started: false, ended: false };
        e.started ||= t.pinch.started;
        e.ended ||= t.pinch.ended;
        edges.set(t.id, e);
      }
      handRuntime.frames.tick(now);
      handRuntime.latency.tick(now, now - (f.captureTime ?? f.timestamp));
    }
    // While frames are flowing, measure the lost-hand grace in frame time so a
    // render stall can't expire a hand whose return is already queued. If
    // frames stop (camera hidden, source stalled), fall back to wall time.
    const flowing = now - lastFrame.current.wall < 500;
    const tracks = tracker.expire(flowing ? lastFrame.current.ts : now);

    const rect = visibleSceneRect(useHudLayout.getState().panelsVisible, size.width, size.height);
    const box = interactionBox(settings.handReach, aspect, rect.width / rect.height);
    const k = 1 - Math.exp((-delta * 1000) / CURSOR_TAU_MS);

    const inputs: PointerInput[] = tracks.map((t) => {
      const target = cameraToScreen(t.anchor, box, rect);
      const prev = display.current.get(t.id);
      const shown = prev
        ? { x: prev.x + (target.x - prev.x) * k, y: prev.y + (target.y - prev.y) * k }
        : target;
      display.current.set(t.id, shown);
      // Edges only count on the render frame that consumed their detections.
      const e = edges.get(t.id);
      const pinch = { ...t.pinch, started: e?.started ?? false, ended: e?.ended ?? false };
      return {
        id: t.id,
        handedness: t.handedness,
        status: t.status,
        screen: shown,
        inBox: target.inBox,
        pinch,
      };
    });
    for (const id of display.current.keys()) {
      if (!tracks.some((t) => t.id === id)) display.current.delete(id);
    }

    const { raycaster, ndc, plane, v, n } = tools;
    const aim = (x: number, y: number) => {
      ndc.fromArray(screenToNdc(x, y, size.width, size.height));
      raycaster.setFromCamera(ndc, state.camera);
    };
    const query: SceneQuery = {
      pick: ({ x, y }) => {
        aim(x, y);
        const hit = raycaster.intersectObjects(objectRegistry.all(), false)[0];
        return (hit?.object.userData.objectId as string | undefined) ?? null;
      },
      planePoint: ({ x, y }, origin) => {
        aim(x, y);
        state.camera.getWorldDirection(n).negate();
        plane.setFromNormalAndCoplanarPoint(n, v.set(origin[0], origin[1], origin[2]));
        const hit = raycaster.ray.intersectPlane(plane, v);
        return hit ? ([hit.x, hit.y, hit.z] as Vec3) : null;
      },
      objectPosition: (id) =>
        useScene.getState().objects.find((o) => o.id === id)?.position ?? null,
    };

    const result = engine.update(now, inputs, query, (id) => handRuntime.mouseDragId === id);
    const scene = useScene.getState();
    for (const cmd of result.commands) scene.dispatch(cmd, 'gesture');
    if (result.grabbing !== wasGrabbing.current) {
      scene.setMode(result.grabbing ? 'moving' : 'selecting', 'gesture');
      wasGrabbing.current = result.grabbing;
    }

    handRuntime.pointers = result.pointers;
    handRuntime.held = result.held;
    handRuntime.hovered = new Set(result.pointers.flatMap((p) => (p.hoverId ? [p.hoverId] : [])));
  });

  return null;
}
