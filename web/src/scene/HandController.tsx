import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Box3, Plane, Raycaster, Sphere, Vector2, Vector3 } from 'three';
import type { Vec3 } from '@/core/interaction/commands';
import {
  HandInteractionEngine,
  type PointerInput,
  type SceneQuery,
} from '@/core/interaction/handInteraction';
import {
  cameraToScreen,
  extendBox,
  interactionBox,
  screenToNdc,
} from '@/core/interaction/handMapping';
import { HandTracker, type TrackSnapshot } from '@/core/tracking/handTracker';
import type { HandFrame } from '@/core/vision/types';
import { handRuntime } from '@/features/hands/handRuntime';
import { useHandTracking } from '@/features/hands/handTrackingStore';
import { useHudLayout } from '@/stores/hudLayout';
import { useScene, type InteractionMode } from '@/stores/scene';
import { useSettings } from '@/stores/settings';
import { GestureMenuController } from '@/features/menu/gestureMenu';
import { isOpenHand } from '@/core/gestures/rules/handPoses';
import { useMenu } from '@/features/menu/menuStore';
import { DrawController } from '@/core/drawing/drawController';
import { DRAW_PLANE_ORIGIN, drawRuntime, useDraw } from '@/features/drawing/drawStore';
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
  const gestureMenu = useMemo(() => new GestureMenuController(), []);
  const drawing = useMemo(() => new DrawController(), []);
  const queue = useRef<HandFrame[]>([]);
  const display = useRef(new Map<number, { x: number; y: number }>());
  const config = useRef('');
  const lastMode = useRef<InteractionMode | null>(null);
  const sizeRef = useRef({ width: 1, height: 1 });
  const lastFrame = useRef({ wall: -Infinity, ts: 0 });

  const tools = useMemo(
    () => ({
      raycaster: new Raycaster(),
      ndc: new Vector2(),
      plane: new Plane(),
      v: new Vector3(),
      n: new Vector3(),
      right: new Vector3(),
      up: new Vector3(),
      back: new Vector3(),
      bounds: new Box3(),
      sphere: new Sphere(),
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
      gestureMenu.reset();
      drawing.reset();
      drawRuntime.resetHands();
      shown.clear();
      handRuntime.reset();
    };
  }, [source, tracker, engine, gestureMenu, drawing]);

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
    engine.configure({ twoHandDepth: settings.twoHandDepth });
    const key = `${settings.trackingSmoothing}|${settings.gestureSensitivity}`;
    if (key !== config.current) {
      tracker.configure({
        smoothing: settings.trackingSmoothing,
        sensitivity: settings.gestureSensitivity,
      });
      config.current = key;
    }

    const aspect = useHandTracking.getState().cameraAspect;
    const hud = useHudLayout.getState();
    const rect = visibleSceneRect(hud.panelsVisible, size.width, size.height, hud.leftInset);
    // Aligned to the scene rect, then extended so the cursor reaches the whole canvas.
    const box = extendBox(
      interactionBox(settings.handReach, aspect, rect.width / rect.height),
      rect,
      { left: 0, top: 0, width: size.width, height: size.height },
    );
    const canvas = { left: 0, top: 0, width: size.width, height: size.height };

    const { raycaster, ndc, plane, v, n, right, up, back, bounds, sphere } = tools;
    state.camera.matrixWorld.extractBasis(right, up, back);
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
      objectPose: (id) => useScene.getState().objects.find((o) => o.id === id) ?? null,
      view: () => ({
        right: [right.x, right.y, right.z],
        up: [up.x, up.y, up.z],
      }),
      objectScreen: (id) => {
        const mesh = objectRegistry.get(id);
        if (!mesh) return null;
        bounds.setFromObject(mesh).getBoundingSphere(sphere);
        const toPx = (p: Vector3) => {
          p.project(state.camera);
          return [((p.x + 1) / 2) * size.width, ((1 - p.y) / 2) * size.height] as const;
        };
        const [cx, cy] = toPx(v.copy(sphere.center));
        const [ex, ey] = toPx(v.copy(sphere.center).addScaledVector(right, sphere.radius));
        return { x: cx, y: cy, r: Math.hypot(ex - cx, ey - cy) };
      },
    };
    const scene = useScene.getState();
    const blocked = (id: string) => handRuntime.mouseDragId === id;
    // While the radial menu is open, hands that aren't holding anything can't
    // grab: their pinches belong to the menu.
    const holding = new Set(handRuntime.held.values());
    const toInputs = (tracks: TrackSnapshot[], edges: boolean): PointerInput[] =>
      tracks.map((t) => {
        const muted = useMenu.getState().open && !holding.has(t.id);
        const mapped = cameraToScreen(t.anchor, box, canvas);
        const tip = cameraToScreen(t.tip, box, canvas);
        return {
          id: t.id,
          handedness: t.handedness,
          status: t.status,
          screen: { x: mapped.x, y: mapped.y },
          inBox: mapped.inBox,
          tip: { x: tip.x, y: tip.y },
          palm: t.palm,
          open: t.world ? isOpenHand(t.world) : false,
          pinch: muted
            ? { ...t.pinch, active: false, closed: false, started: false, ended: false }
            : edges
              ? t.pinch
              : { ...t.pinch, started: false, ended: false },
        };
      });
    const run = (t: number, inputs: PointerInput[]) => {
      const r = engine.update(t, inputs, query, blocked);
      for (const cmd of r.commands) scene.dispatch(cmd, 'gesture');
      const mode = r.twoHand[0]?.mode ?? 'none';
      const modes = handRuntime.twoHandModes;
      if (modes.at(-1) !== mode) {
        modes.push(mode);
        if (modes.length > 200) modes.shift();
      }
      return r;
    };
    // Draw tool: pinches in empty space become strokes (after the engine, so
    // a pinch that grabs an object stays a grab).
    const draw = useDraw.getState();
    const drawActive = draw.active && !useMenu.getState().open;
    const runDraw = (t: number, inputs: PointerInput[], r: ReturnType<typeof run>) => {
      if (!drawActive && drawing.live.size === 0) return;
      const pens = inputs.map((i) => ({
        id: i.id,
        lost: i.status === 'lost',
        screen: i.screen,
        pinch: i.pinch,
        grabbing: r.pointers.some((p) => p.id === i.id && p.grabbedId !== null),
      }));
      const u = drawing.update(t, drawActive, pens, (sp) =>
        query.planePoint(sp, DRAW_PLANE_ORIGIN),
      );
      for (const points of u.finished) {
        scene.dispatch({ type: 'addStroke', points, color: draw.color }, 'gesture');
      }
      if (u.changed) {
        drawRuntime.resetHands();
        for (const [id, b] of drawing.live) drawRuntime.live.set(id, b.points);
      }
    };

    // Interaction logic runs once per DETECTION, in order, so it never depends
    // on the render rate: a render stall can't drop a grab, skip the last
    // moves before a release, or merge pinch edges.
    let result: ReturnType<HandInteractionEngine['update']> | null = null;
    const batch = queue.current.splice(0);
    for (const f of batch) {
      const frameTracks = tracker.update(f, aspect);
      const inputs = toInputs(frameTracks, true);
      result = run(f.timestamp, inputs);
      runDraw(f.timestamp, inputs, result);
      gestureMenu.update(f.timestamp, frameTracks, result, rect, settings.palmMenu);
      handRuntime.frames.tick(now);
      handRuntime.latency.tick(now, now - (f.captureTime ?? f.timestamp));
    }
    if (batch.length) {
      lastFrame.current = { wall: now, ts: batch.at(-1)!.timestamp };
      handRuntime.lastFrameTs = lastFrame.current.ts;
    }

    // While frames are flowing, measure the lost-hand grace in frame time so a
    // render stall can't expire a hand whose return is already queued. If
    // frames stop (camera hidden, source stalled), fall back to wall time.
    const flowing = now - lastFrame.current.wall < 500;
    const expireAt = flowing ? lastFrame.current.ts : now;
    const before = tracker.snapshot().length;
    const tracks = tracker.expire(expireAt);
    if (!result || tracks.length !== before) {
      const inputs = toInputs(tracks, false);
      result = run(expireAt, inputs);
      runDraw(expireAt, inputs, result);
    }

    const mode: InteractionMode = result.twoHand.some((t) => t.mode === 'two')
      ? 'twoHand'
      : result.depth.length
        ? 'depth'
        : result.grabbing
          ? 'moving'
          : 'selecting';
    // Only on changes, and never before the first grab, so mouse modes stand.
    if (mode !== lastMode.current && (lastMode.current !== null || mode !== 'selecting')) {
      scene.setMode(mode, 'gesture');
    }
    lastMode.current = mode;

    // Cursors are drawn eased at render rate between 30 Hz detections.
    const k = 1 - Math.exp((-delta * 1000) / CURSOR_TAU_MS);
    for (const p of result.pointers) {
      const prev = display.current.get(p.id);
      const shown = prev
        ? { x: prev.x + (p.screen.x - prev.x) * k, y: prev.y + (p.screen.y - prev.y) * k }
        : p.screen;
      display.current.set(p.id, shown);
      p.screen = shown;
    }
    for (const id of display.current.keys()) {
      if (!result.pointers.some((p) => p.id === id)) display.current.delete(id);
    }

    handRuntime.pointers = result.pointers;
    handRuntime.held = result.held;
    handRuntime.twoHand = result.twoHand;
    handRuntime.depth = result.depth;
    handRuntime.hovered = new Set(result.pointers.flatMap((p) => (p.hoverId ? [p.hoverId] : [])));
  });

  return null;
}
