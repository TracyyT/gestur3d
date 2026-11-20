import type { PinchState } from '@/core/tracking/pinch';
import type { Handedness } from '@/core/vision/types';
import type { Command, Vec3 } from './commands';

/** What a hand is doing, from the user's point of view. */
export type PointerPhase = 'tracking' | 'hovering' | 'pinching' | 'grabbing' | 'lost';

export interface ScreenPos {
  x: number;
  y: number;
}

/** One tracked hand, already mapped to screen space. */
export interface PointerInput {
  id: number;
  handedness: Handedness;
  status: 'tracking' | 'lost';
  screen: ScreenPos;
  /** False when the hand is outside the interaction box. */
  inBox: boolean;
  pinch: PinchState;
}

/** A hand's interaction state, for rendering feedback and future two-hand gestures. */
export interface HandPointer {
  id: number;
  handedness: Handedness;
  phase: PointerPhase;
  screen: ScreenPos;
  pinchStrength: number;
  /** Smoothed thumb-index / palm ratio, for calibration readouts. */
  pinchRatio: number;
  hoverId: string | null;
  grabbedId: string | null;
  /** When this pointer last released an object (for the release ripple). */
  releasedAt: number | null;
}

/** Scene queries the engine needs; implemented by the 3D layer with the real camera. */
export interface SceneQuery {
  /** Id of the object under a screen point, if any. */
  pick(screen: ScreenPos): string | null;
  /** Where the ray through `screen` meets the camera-facing plane through `origin`. */
  planePoint(screen: ScreenPos, origin: Vec3): Vec3 | null;
  objectPosition(id: string): Vec3 | null;
}

export interface EngineResult {
  pointers: HandPointer[];
  commands: Command[];
  /** objectId → pointer id holding it. */
  held: Map<string, number>;
  /** True while any hand is grabbing (for the HUD mode readout). */
  grabbing: boolean;
}

interface GrabState {
  objectId: string;
  /** Plane through the object's position when grabbed. */
  planeOrigin: Vec3;
  /** Object position minus grab point, so the object doesn't snap to the cursor. */
  offset: Vec3;
  last: Vec3;
}

interface PointerMemory {
  grab: GrabState | null;
  /** Pinch started over nothing (or with nothing grabbable): ignore until released. */
  emptyPinch: boolean;
  releasedAt: number | null;
}

const MOVE_EPSILON = 1e-4;

/**
 * Hover / grab / move / release for hands.
 *
 * Rules:
 * - Hover = object under the cursor (only while tracked and inside the box).
 * - A grab starts only on the pinch's *start* edge, on the hovered object.
 *   Sweeping a closed pinch across objects never picks them up, and a hand that
 *   appears already pinched does nothing until it opens.
 * - One hand per object; objects being dragged by the mouse can't be grabbed.
 * - While held, the object follows the cursor on a camera-facing plane, keeping
 *   the grab offset.
 * - Tracking lost: the object freezes in place. If the hand comes back (same
 *   track, within the tracker's grace period) the grab continues; if the track
 *   expires, the object is released where it is.
 */
export class HandInteractionEngine {
  private memory = new Map<number, PointerMemory>();

  update(
    now: number,
    inputs: PointerInput[],
    scene: SceneQuery,
    blocked: (id: string) => boolean,
  ): EngineResult {
    const commands: Command[] = [];
    const held = new Map<string, number>();
    for (const [id, m] of this.memory) if (m.grab) held.set(m.grab.objectId, id);

    // Tracks that disappeared: release whatever they held, in place.
    const live = new Set(inputs.map((p) => p.id));
    for (const [id, m] of this.memory) {
      if (live.has(id)) continue;
      if (m.grab) held.delete(m.grab.objectId);
      this.memory.delete(id);
    }

    const pointers: HandPointer[] = [];
    for (const input of inputs) {
      let m = this.memory.get(input.id);
      if (!m) {
        // A hand that appears mid-pinch must open before it can grab. Check the
        // raw closed state too: the debounced `active` lags the first frames.
        m = {
          grab: null,
          emptyPinch: input.pinch.active || !!input.pinch.closed,
          releasedAt: null,
        };
        this.memory.set(input.id, m);
      }

      if (input.status === 'lost') {
        pointers.push(this.pointer(input, 'lost', null, m));
        continue;
      }

      const hoverId = !m.grab && input.inBox ? scene.pick(input.screen) : null;

      if (m.grab) {
        if (input.pinch.ended || !input.pinch.active) {
          held.delete(m.grab.objectId);
          m.grab = null;
          m.releasedAt = now;
          pointers.push(this.pointer(input, hoverId ? 'hovering' : 'tracking', hoverId, m));
          continue;
        }
        // Fingers opening (still pinched, past the start threshold): hold the
        // object still so letting go never drags it.
        const hit = input.pinch.releasing
          ? null
          : scene.planePoint(input.screen, m.grab.planeOrigin);
        if (hit) {
          const next: Vec3 = [
            hit[0] + m.grab.offset[0],
            hit[1] + m.grab.offset[1],
            hit[2] + m.grab.offset[2],
          ];
          const moved = Math.hypot(
            next[0] - m.grab.last[0],
            next[1] - m.grab.last[1],
            next[2] - m.grab.last[2],
          );
          if (moved > MOVE_EPSILON) {
            commands.push({ type: 'setPosition', id: m.grab.objectId, position: next });
            m.grab.last = next;
          }
        }
        pointers.push(this.pointer(input, 'grabbing', null, m));
        continue;
      }

      if (m.emptyPinch) {
        if (!input.pinch.active && !input.pinch.closed) m.emptyPinch = false;
        else {
          pointers.push(this.pointer(input, 'pinching', hoverId, m));
          continue;
        }
      }

      if (input.pinch.started) {
        const target = hoverId && !held.has(hoverId) && !blocked(hoverId) ? hoverId : null;
        const origin = target ? scene.objectPosition(target) : null;
        const hit = origin ? scene.planePoint(input.screen, origin) : null;
        if (target && origin && hit) {
          m.grab = {
            objectId: target,
            planeOrigin: origin,
            offset: [origin[0] - hit[0], origin[1] - hit[1], origin[2] - hit[2]],
            last: origin,
          };
          held.set(target, input.id);
          commands.push({ type: 'select', id: target });
          pointers.push(this.pointer(input, 'grabbing', null, m));
          continue;
        }
        m.emptyPinch = true;
        pointers.push(this.pointer(input, 'pinching', hoverId, m));
        continue;
      }

      pointers.push(this.pointer(input, hoverId ? 'hovering' : 'tracking', hoverId, m));
    }

    return { pointers, commands, held, grabbing: held.size > 0 };
  }

  /** Release everything (e.g. camera turned off). */
  reset() {
    this.memory.clear();
  }

  private pointer(
    input: PointerInput,
    phase: PointerPhase,
    hoverId: string | null,
    m: PointerMemory,
  ): HandPointer {
    return {
      id: input.id,
      handedness: input.handedness,
      phase,
      screen: input.screen,
      pinchStrength: input.pinch.strength,
      pinchRatio: input.pinch.ratio,
      hoverId,
      grabbedId: m.grab?.objectId ?? null,
      releasedAt: m.releasedAt,
    };
  }
}
