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
  /** Playback speed (< 1 = slower, for capturing screenshots). */
  speed?: number;
  /** How firmly the pinch closes (1 = fingertips touching; ~0.72 ≈ a light real pinch). */
  grip?: number;
  /** Grip in the middle of the move, to simulate a hand loosening while carrying. */
  loosenTo?: number;
}

/** One keyframe of a scripted hand, aimed at a scene-rect UV. */
export interface HandKey extends UV {
  at: number;
  pinch: number;
  visible?: boolean;
  /** Synthetic hand size (default 0.12); bigger = closer to the camera. */
  size?: number;
  /** Pointing pose: index up, other fingers curled (opens the menu when held). */
  point?: boolean;
}

export interface TwoHandScript {
  right: HandKey[];
  left: HandKey[];
  speed?: number;
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
function wristAt(uv: UV, pinch: number, handedness: Handedness, size = 0.12): [number, number] {
  const rect = sceneRect();
  const box = interactionBox(useSettings.getState().handReach, ASPECT, rect.width / rect.height);
  const target = screenToCamera(uv.u, uv.v, box);
  return wristForAnchor(target, {
    pinch,
    handedness,
    size,
    aspect: ASPECT,
    mode: DEFAULT_TRACKER_OPTIONS.anchorMode,
  });
}

function play(recording: Recording, speed = 1): Promise<void> {
  return new Promise((resolve) => {
    useHandTracking.getState().source?.dispose();
    const source = new ReplayHandSource(recording, {
      speed,
      onEnd: () => setTimeout(resolve, 150),
    });
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
  grip = 1,
  loosenTo,
}: GrabScript): Recording {
  const k = (at: number, uv: UV, pinch: number, visible = true): Keyframe => {
    const [cx, cy] = wristAt(uv, pinch, handedness);
    return { at, cx, cy, pinch, visible };
  };
  const mid = { u: (from.u + to.u) / 2, v: (from.v + to.v) / 2 };
  const keys: Keyframe[] = [k(0, from, 0), k(400, from, 0), k(550, from, grip), k(800, from, grip)];
  if (dropoutMs > 0) {
    keys.push(
      k(1100, mid, grip),
      k(1101, mid, grip, false),
      k(1100 + dropoutMs, mid, grip, false),
      k(1101 + dropoutMs, mid, grip),
    );
    keys.push(
      k(1500 + dropoutMs, to, grip),
      k(1800 + dropoutMs, to, grip),
      k(1950 + dropoutMs, to, 0),
      k(2300 + dropoutMs, to, 0),
    );
  } else if (loosenTo !== undefined) {
    keys.push(
      k(1200, mid, loosenTo),
      k(1600, to, grip),
      k(1900, to, grip),
      k(2050, to, 0),
      k(2400, to, 0),
    );
  } else {
    keys.push(k(1600, to, grip), k(1900, to, grip), k(2050, to, 0), k(2400, to, 0));
  }
  return scriptedRecording(keys, { handedness, aspect: ASPECT, jitter });
}

function handRecording(keys: HandKey[], handedness: Handedness, jitter = 0): Recording {
  return scriptedRecording(
    keys.map(({ at, u, v, pinch, visible, size, point }) => {
      const [cx, cy] = wristAt({ u, v }, pinch, handedness, size);
      return { at, cx, cy, pinch, visible, size, point };
    }),
    { handedness, aspect: ASPECT, jitter },
  );
}

/** Two single-hand recordings played together, frame by frame. */
function twoHandRecording({ right, left, jitter = 0 }: TwoHandScript): Recording {
  const r = handRecording(right, 'Right', jitter);
  const l = handRecording(left, 'Left', jitter);
  const n = Math.max(r.frames.length, l.frames.length);
  const frames: Recording['frames'] = [];
  for (let i = 0; i < n; i++) {
    const a = r.frames[i];
    const b = l.frames[i];
    const base = (a ?? b)!;
    frames.push({ ...base, hands: [...(a?.hands ?? []), ...(b?.hands ?? [])] });
  }
  return { ...r, frames };
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
      useScene.getState().objects.map((o) => ({
        id: o.id,
        position: [...o.position],
        rotation: [...o.rotation],
        scale: o.scale,
      })),
    twoHand: () => handRuntime.twoHand.map((t) => ({ ...t })),
    /** Two-hand mode changes seen by the engine (every detection frame, not just rendered ones). */
    twoHandModes: () => [...handRuntime.twoHandModes],
    /** Script time (ms) of the last detection frame the engine processed, during replay. */
    scriptTime: () => {
      const source = useHandTracking.getState().source;
      return source instanceof ReplayHandSource
        ? source.recordingTime(handRuntime.lastFrameTs)
        : null;
    },
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
    playGrab: (script: GrabScript) => play(grabRecording(script), script.speed),
    /** Both hands, each keyframed in scene UV. */
    playTwoHand: (script: TwoHandScript) => play(twoHandRecording(script), script.speed),
    /** One hand, keyframed in scene UV. */
    playHand: (keys: HandKey[], handedness: Handedness = 'Right') =>
      play(handRecording(keys, handedness)),
    /** A pinch closed over empty space, then swept across `to` (must not grab). */
    playSweep: (from: UV, to: UV, handedness: Handedness = 'Right') => {
      const k = (at: number, uv: UV, pinch: number): Keyframe => {
        const [cx, cy] = wristAt(uv, pinch, handedness);
        return { at, cx, cy, pinch };
      };
      return play(
        scriptedRecording(
          [
            k(0, from, 0),
            k(300, from, 0),
            k(450, from, 1),
            k(700, from, 1),
            k(1400, to, 1),
            k(1700, to, 1),
            k(1850, to, 0),
            k(2100, to, 0),
          ],
          {
            handedness,
          },
        ),
      );
    },
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
