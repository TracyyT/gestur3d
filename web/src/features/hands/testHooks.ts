import { interactionBox, screenToCamera } from '@/core/interaction/handMapping';
import { DEFAULT_TRACKER_OPTIONS } from '@/core/tracking/handTracker';
import { scriptedRecording, wristForAnchor, type Keyframe } from '@/core/tracking/scripts';
import type { Recording } from '@/core/vision/recording';
import { ReplayHandSource } from '@/core/vision/replaySource';
import type { Handedness } from '@/core/vision/types';
import { visibleSceneRect } from '@/scene/framing';
import { useHudLayout } from '@/stores/hudLayout';
import { useScene } from '@/stores/scene';
import { useSettings } from '@/stores/settings';
import { handRuntime } from './handRuntime';
import { useHandTracking } from './handTrackingStore';

interface UV {
  u: number;
  v: number;
}

export interface GrabScript {
  from: UV;
  to: UV;
  handedness?: Handedness;
  /** Hide the hand for this long in the middle of the move. */
  dropoutMs?: number;
  /** Uniform landmark noise, camera-normalized. */
  jitter?: number;
}

const ASPECT = 16 / 9;

function sceneRect() {
  return visibleSceneRect(
    useHudLayout.getState().panelsVisible,
    window.innerWidth,
    window.innerHeight,
  );
}

/** Raw camera wrist position that puts the cursor at a scene-rect UV. */
function wristAt(uv: UV, pinch: number, handedness: Handedness): [number, number] {
  const rect = sceneRect();
  const box = interactionBox(useSettings.getState().handReach, ASPECT, rect.width / rect.height);
  const target = screenToCamera(uv.u, uv.v, box);
  return wristForAnchor(target, {
    pinch,
    handedness,
    aspect: ASPECT,
    mode: DEFAULT_TRACKER_OPTIONS.anchorMode,
  });
}

function play(recording: Recording): Promise<void> {
  return new Promise((resolve) => {
    useHandTracking.getState().source?.dispose();
    const source = new ReplayHandSource(recording, { onEnd: () => setTimeout(resolve, 150) });
    useHandTracking.getState().set({
      status: 'running',
      source,
      backend: 'replay',
      delegate: null,
      cameraAspect: recording.cameraAspect,
    });
    source.start();
  });
}

/** Scripted pinch-grab from one point to another, aimed through the real mapping. */
function grabRecording({
  from,
  to,
  handedness = 'Right',
  dropoutMs = 0,
  jitter = 0,
}: GrabScript): Recording {
  const k = (at: number, uv: UV, pinch: number, visible = true): Keyframe => {
    const [cx, cy] = wristAt(uv, pinch, handedness);
    return { at, cx, cy, pinch, visible };
  };
  const mid = { u: (from.u + to.u) / 2, v: (from.v + to.v) / 2 };
  const keys: Keyframe[] = [k(0, from, 0), k(400, from, 0), k(550, from, 1), k(800, from, 1)];
  if (dropoutMs > 0) {
    keys.push(
      k(1100, mid, 1),
      k(1101, mid, 1, false),
      k(1100 + dropoutMs, mid, 1, false),
      k(1101 + dropoutMs, mid, 1),
    );
    keys.push(
      k(1500 + dropoutMs, to, 1),
      k(1800 + dropoutMs, to, 1),
      k(1950 + dropoutMs, to, 0),
      k(2300 + dropoutMs, to, 0),
    );
  } else {
    keys.push(k(1600, to, 1), k(1900, to, 1), k(2050, to, 0), k(2400, to, 0));
  }
  return scriptedRecording(keys, { handedness, aspect: ASPECT, jitter });
}

/**
 * Test-only API on window.__G3D__, enabled when a test sets
 * window.__G3D_TEST_HOOKS__ = true before the page loads. Lets end-to-end
 * tests drive the real hand pipeline with scripted landmarks.
 */
export function installTestHooks() {
  const w = window as unknown as { __G3D_TEST_HOOKS__?: boolean; __G3D__?: unknown };
  if (!w.__G3D_TEST_HOOKS__) return;
  w.__G3D__ = {
    objects: () =>
      useScene.getState().objects.map((o) => ({ id: o.id, position: [...o.position] })),
    selectedId: () => useScene.getState().selectedId,
    pointers: () => handRuntime.pointers.map((p) => ({ ...p, screen: { ...p.screen } })),
    sceneRect,
    /** Where an object's center appears, as UV of the visible scene rect. */
    objectUV(id: string): UV | null {
      const o = useScene.getState().objects.find((x) => x.id === id);
      const p = o && handRuntime.project?.(o.position);
      if (!p) return null;
      const r = sceneRect();
      return { u: (p.x - r.left) / r.width, v: (p.y - r.top) / r.height };
    },
    play,
    playGrab: (script: GrabScript) => play(grabRecording(script)),
    /** Hold one hand still and open at a UV for `ms` (jitter / idle checks). */
    playHold: (uv: UV, ms: number, jitter = 0, handedness: Handedness = 'Right') => {
      const [cx, cy] = wristAt(uv, 0, handedness);
      return play(
        scriptedRecording(
          [
            { at: 0, cx, cy, pinch: 0 },
            { at: ms, cx, cy, pinch: 0 },
          ],
          { handedness, jitter },
        ),
      );
    },
  };
}
