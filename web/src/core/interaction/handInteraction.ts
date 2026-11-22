import type { PinchState } from '@/core/tracking/pinch';
import type { Handedness } from '@/core/vision/types';
import { OneEuroFilter } from '@/core/tracking/oneEuro';
import {
  BimanualGrip,
  softDeadZone,
  TWO_HAND_DEPTH_GAIN,
  type Pose,
  type ViewBasis,
} from './bimanual';
import type { Command, Vec3 } from './commands';
import { clampPosition } from './sceneModel';

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
  /**
   * Where the pinch point (between the fingertips) maps on screen. Two-hand
   * scale and turn measure from here, because two hands' pinch points can
   * meet while their knuckle cursors can't.
   */
  tip?: ScreenPos;
  /** Apparent palm size (larger = closer to the camera), for the depth gesture. */
  palm?: number;
  /** Open hand (fingers extended, palm toward the camera), for the depth gesture. */
  open?: boolean;
  pinch: PinchState;
}

/** A hand's interaction state, for rendering feedback and future two-hand gestures. */
export interface HandPointer {
  id: number;
  handedness: Handedness;
  phase: PointerPhase;
  screen: ScreenPos;
  /** Pinch point on screen, unsmoothed by the render easing (see PointerInput). */
  tip?: ScreenPos;
  pinchStrength: number;
  /** Smoothed thumb-index / palm ratio, for calibration readouts. */
  pinchRatio: number;
  /** Inside the reach box (cursor on the scene). */
  inBox: boolean;
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
  /** Full pose; defaults to the position with no rotation and scale 1. */
  objectPose?(id: string): Pose | null;
  /** The object's on-screen center and radius (px), if known. */
  objectScreen?(id: string): { x: number; y: number; r: number } | null;
  /** Camera axes in world space; defaults to +X right, +Y up. */
  view?(): ViewBasis;
}

/** What a two-hand grab is doing this frame. */
export type TwoHandMode = 'two' | 'one' | 'frozen';

export interface TwoHandInfo {
  objectId: string;
  /** Pointer ids, lower first. */
  pointerIds: [number, number];
  /** 'two' = both hands driving; 'one' = one hand lost, the other moving; 'frozen' = neither. */
  mode: TwoHandMode;
  /** Id of a hand that is in the grab but lost, if any. */
  lostId: number | null;
  scaleFactor: number;
  /** Raw fingertip spread relative to the last snapshot (see BimanualResult). */
  spread: number;
  /** Raw turn of the fingertip line since the last snapshot, radians. */
  turn: number;
  /** Depth moved since the last snapshot, world units toward the camera. */
  depth: number;
  /** Roll since the two-hand grab started, radians. */
  roll: number;
  scale: number;
  atLimit: boolean;
  /** Hands too close together: scale and roll hold. */
  holding: boolean;
}

export interface EngineResult {
  pointers: HandPointer[];
  commands: Command[];
  /** objectId → pointer id holding it. */
  held: Map<string, number>;
  /** True while any hand is grabbing (for the HUD mode readout). */
  grabbing: boolean;
  /** Active two-hand grabs. */
  twoHand: TwoHandInfo[];
  /** Active open-hand depth controls. */
  depth: DepthInfo[];
}

interface GrabState {
  objectId: string;
  /** Plane through the object's position when grabbed. */
  planeOrigin: Vec3;
  /** Object position minus grab point, so the object doesn't snap to the cursor. */
  offset: Vec3;
  last: Vec3;
  /** The other hand, held open over the object, is setting its depth. */
  depth?: DepthControl;
  /** An open hand over the object, waiting out the engage delay. */
  pendingDepth?: { hand: number; since: number };
}

interface DepthControl {
  hand: number;
  /** log palm size when depth control started. */
  logPalm0: number;
  filter: OneEuroFilter;
  /** World units toward the camera since depth control started. */
  value: number;
  /** Last time the hand still qualified (for the exit grace). */
  seen: number;
}

/** What the open-hand depth gesture is doing, for feedback. */
export interface DepthInfo {
  objectId: string;
  /** Hand holding the object. */
  holderId: number;
  /** Open hand setting the depth. */
  handId: number;
  /** World units toward the camera since it started (negative = away). */
  depth: number;
}

/** Open-hand depth tuning. */
export const DEPTH_HAND = {
  /** The open hand must stay over the object this long before it takes over. */
  engageMs: 250,
  /** Brief non-open frames (a finger flicker) don't end it. */
  exitMs: 200,
  /** World units per unit of log palm-size change (same as two-hand depth). */
  gain: 8,
  /**
   * The open hand counts as "over" the object within this × its on-screen
   * radius of its center, and never less than `minZonePx`, so small objects
   * don't need both hands squeezed onto them.
   */
  zoneScale: 1.8,
  minZonePx: 150,
  deadZone: 0.03,
  filter: { minCutoff: 0.6, beta: 0.3, dCutoff: 1.0 },
} as const;

interface PointerMemory {
  grab: GrabState | null;
  /** Pinch started over nothing (or with nothing grabbable): ignore until released. */
  emptyPinch: boolean;
  releasedAt: number | null;
}

interface TwoHandSession {
  objectId: string;
  ids: [number, number];
  /** Null until both hands drive it, and while it isn't in 'two' mode. */
  grip: BimanualGrip | null;
  /** Who was driving on the previous frame: 'two', a pointer id, or 'none'. */
  driver: 'two' | number | 'none';
  /** Either hand's fingers are opening: hold everything still. */
  paused: boolean;
  pose: Pose;
  /**
   * Camera-facing plane the grips are measured on, fixed at each snapshot so
   * depth moves don't change how hand motion maps to the scene.
   */
  planeOrigin: Vec3;
  info: TwoHandInfo;
}

const MOVE_EPSILON = 1e-4;
const DEFAULT_VIEW: ViewBasis = { right: [1, 0, 0], up: [0, 1, 0] };

/** Unit vector a × b. */
function cross(a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  const c: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const l = Math.hypot(c[0], c[1], c[2]) || 1;
  return [c[0] / l, c[1] / l, c[2] / l];
}

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
 *
 * Two hands:
 * - A second hand that starts a pinch on an object held by one hand, or on
 *   empty space, joins the grab. Both hands then move, scale and roll it
 *   (`BimanualGrip`).
 * - Whenever the set of hands driving the object changes (join, release, a hand
 *   lost or back), the drivers re-anchor on the object's current pose, so it
 *   never jumps. Scale and rotation reached with two hands are kept.
 * - One hand lost: the other keeps moving it; scale and rotation hold. Both
 *   lost: it freezes. A hand whose track expires leaves the grab.
 */
export interface EngineOptions {
  /** Both hands moving toward / away from the camera move a two-hand grab in depth. */
  twoHandDepth: boolean;
}

export class HandInteractionEngine {
  private memory = new Map<number, PointerMemory>();
  private sessions = new Map<string, TwoHandSession>();
  private options: EngineOptions = { twoHandDepth: true };

  configure(options: Partial<EngineOptions>) {
    this.options = { ...this.options, ...options };
  }

  update(
    now: number,
    inputs: PointerInput[],
    scene: SceneQuery,
    blocked: (id: string) => boolean,
  ): EngineResult {
    const commands: Command[] = [];
    const held = new Map<string, number>();
    for (const [id, m] of this.memory)
      if (m.grab && !held.has(m.grab.objectId)) held.set(m.grab.objectId, id);
    const byId = new Map(inputs.map((p) => [p.id, p]));

    // Tracks that disappeared: release whatever they held, in place. A hand
    // that leaves a two-hand grab hands the object to the other.
    for (const [id, m] of this.memory) {
      if (byId.has(id)) continue;
      if (m.grab) {
        const session = this.sessions.get(m.grab.objectId);
        if (session) this.leaveSession(session, id, byId, scene);
        else held.delete(m.grab.objectId);
      }
      this.memory.delete(id);
    }

    const view = scene.view?.() ?? DEFAULT_VIEW;
    const toward = cross(view.right, view.up);
    this.updateDepth(now, inputs, byId, scene);

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

      // Members of a two-hand grab are handled together below.
      if (m.grab && this.sessions.has(m.grab.objectId)) continue;

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
        this.moveOneHand(input, m.grab, scene, commands, toward);
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
        // Joining an object another hand holds alone?
        const joinId = this.joinTarget(input, hoverId, held, blocked);
        if (joinId !== null) {
          const holderId = held.get(joinId)!;
          const ids: [number, number] =
            holderId < input.id ? [holderId, input.id] : [input.id, holderId];
          const pose = this.currentPose(joinId, this.memory.get(holderId)!.grab!, scene);
          m.grab = this.anchor(joinId, pose.position, input, scene);
          const session: TwoHandSession = {
            objectId: joinId,
            ids,
            grip: null,
            driver: 'none',
            paused: false,
            pose,
            planeOrigin: [...pose.position],
            info: {
              objectId: joinId,
              pointerIds: ids,
              mode: 'frozen',
              lostId: null,
              scaleFactor: 1,
              spread: 1,
              turn: 0,
              depth: 0,
              roll: 0,
              scale: pose.scale,
              atLimit: false,
              holding: false,
            },
          };
          this.sessions.set(joinId, session);
          // The holder may already be in `pointers` this frame: drop its entry,
          // the session emits both.
          const i = pointers.findIndex((p) => p.id === holderId);
          if (i !== -1) pointers.splice(i, 1);
          continue;
        }

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

    for (const session of [...this.sessions.values()]) {
      this.updateSession(now, session, byId, scene, commands, pointers, held);
    }

    return {
      pointers,
      commands,
      held,
      grabbing: held.size > 0,
      twoHand: [...this.sessions.values()].map((s) => s.info),
      depth: [...this.memory].flatMap(([holderId, m]) =>
        m.grab?.depth
          ? [
              {
                objectId: m.grab.objectId,
                holderId,
                handId: m.grab.depth.hand,
                depth: m.grab.depth.value,
              },
            ]
          : [],
      ),
    };
  }

  /** Release everything (e.g. camera turned off). */
  reset() {
    this.memory.clear();
    this.sessions.clear();
  }

  /**
   * The object this hand's new pinch should join, if any. Pinching on an
   * object held by the other hand alone joins it; so does pinching on empty
   * space, so a small object doesn't need both hands on it. Pinching on a
   * different, free object grabs that one instead (returns null).
   */
  private joinTarget(
    input: PointerInput,
    hoverId: string | null,
    held: Map<string, number>,
    blocked: (id: string) => boolean,
  ): string | null {
    if (!input.inBox) return null;
    const ok = (id: string) =>
      held.has(id) && held.get(id) !== input.id && !this.sessions.has(id) && !blocked(id);
    if (hoverId) return ok(hoverId) ? hoverId : null;
    const candidates = [...held.keys()].filter(ok);
    return candidates.length === 1 ? candidates[0]! : null;
  }

  /** The object's pose right now, from what this engine last commanded. */
  private currentPose(id: string, grab: GrabState, scene: SceneQuery): Pose {
    const known = scene.objectPose?.(id);
    return {
      position: clampPosition(grab.last),
      rotation: known ? [...known.rotation] : [0, 0, 0, 1],
      scale: known?.scale ?? 1,
    };
  }

  /** A one-hand grab of `id` at `position`, keeping the object where it is. */
  private anchor(id: string, position: Vec3, input: PointerInput, scene: SceneQuery): GrabState {
    const hit = scene.planePoint(input.screen, position);
    return {
      objectId: id,
      planeOrigin: [...position],
      offset: hit ? [position[0] - hit[0], position[1] - hit[1], position[2] - hit[2]] : [0, 0, 0],
      last: [...position],
    };
  }

  /**
   * Open-hand depth: while one hand holds an object alone, the other hand,
   * held open over the object for a moment, sets how far it is from the
   * camera. Bringing that hand closer (its palm looks bigger) brings the
   * object closer. The holding hand keeps moving it sideways and up/down.
   * It ends when the open hand closes, pinches (which joins a two-hand grab),
   * or leaves; the object stays at its new depth.
   */
  private updateDepth(
    now: number,
    inputs: PointerInput[],
    byId: Map<number, PointerInput>,
    scene: SceneQuery,
  ) {
    for (const [holderId, m] of this.memory) {
      const grab = m.grab;
      if (!grab || this.sessions.has(grab.objectId)) continue;
      const holder = byId.get(holderId);
      if (!holder || holder.status !== 'tracking') continue;

      const qualifies = (p: PointerInput | undefined): p is PointerInput & { palm: number } =>
        !!p &&
        p.id !== holderId &&
        p.status === 'tracking' &&
        !!p.open &&
        !p.pinch.active &&
        !p.pinch.closed &&
        !this.memory.get(p.id)?.grab &&
        !!p.palm &&
        p.palm > 0;

      if (grab.depth) {
        const d = grab.depth;
        const hand = byId.get(d.hand);
        const pinching = !!hand && (hand.pinch.active || !!hand.pinch.closed);
        if (qualifies(hand)) {
          d.seen = now;
          d.value =
            DEPTH_HAND.gain *
            d.filter.filter(
              softDeadZone(Math.log(hand.palm) - d.logPalm0, DEPTH_HAND.deadZone),
              now,
            );
        } else if (pinching || !hand || now - d.seen > DEPTH_HAND.exitMs) {
          // Keep the new depth: re-anchor the holding hand where the object is.
          m.grab = this.anchor(grab.objectId, grab.last, holder, scene);
        }
        continue;
      }

      const zone = scene.objectScreen?.(grab.objectId);
      const near = (p: PointerInput) =>
        scene.pick(p.screen) === grab.objectId ||
        (!!zone &&
          Math.hypot(p.screen.x - zone.x, p.screen.y - zone.y) <=
            Math.max(zone.r * DEPTH_HAND.zoneScale, DEPTH_HAND.minZonePx));
      const over = inputs.find((p) => qualifies(p) && p.inBox && near(p));
      if (!over) {
        grab.pendingDepth = undefined;
        continue;
      }
      if (grab.pendingDepth?.hand !== over.id) grab.pendingDepth = { hand: over.id, since: now };
      if (now - grab.pendingDepth.since >= DEPTH_HAND.engageMs) {
        const filter = new OneEuroFilter(DEPTH_HAND.filter);
        filter.filter(0, now);
        grab.depth = {
          hand: over.id,
          logPalm0: Math.log((over as PointerInput & { palm: number }).palm),
          filter,
          value: 0,
          seen: now,
        };
        grab.pendingDepth = undefined;
      }
    }
  }

  private moveOneHand(
    input: PointerInput,
    grab: GrabState,
    scene: SceneQuery,
    commands: Command[],
    toward: Vec3 = [0, 0, 1],
  ) {
    // Fingers opening (still pinched, past the start threshold): hold the
    // object still so letting go never drags it.
    const hit = input.pinch.releasing ? null : scene.planePoint(input.screen, grab.planeOrigin);
    if (!hit) return;
    const z = grab.depth?.value ?? 0;
    const next: Vec3 = [
      hit[0] + grab.offset[0] + toward[0] * z,
      hit[1] + grab.offset[1] + toward[1] * z,
      hit[2] + grab.offset[2] + toward[2] * z,
    ];
    const moved = Math.hypot(
      next[0] - grab.last[0],
      next[1] - grab.last[1],
      next[2] - grab.last[2],
    );
    if (moved > MOVE_EPSILON) {
      commands.push({ type: 'setPosition', id: grab.objectId, position: next });
      grab.last = next;
    }
  }

  /** Remove `leaving` from a two-hand grab; the other hand keeps it, re-anchored. */
  private leaveSession(
    session: TwoHandSession,
    leaving: number,
    byId: Map<number, PointerInput>,
    scene: SceneQuery,
  ) {
    this.sessions.delete(session.objectId);
    const otherId = session.ids[0] === leaving ? session.ids[1] : session.ids[0];
    const other = this.memory.get(otherId);
    const input = byId.get(otherId);
    if (other?.grab) {
      other.grab = input
        ? this.anchor(session.objectId, session.pose.position, input, scene)
        : { ...other.grab, last: [...session.pose.position] };
    }
  }

  private updateSession(
    now: number,
    s: TwoHandSession,
    byId: Map<number, PointerInput>,
    scene: SceneQuery,
    commands: Command[],
    pointers: HandPointer[],
    held: Map<string, number>,
  ) {
    const [ia, ib] = s.ids;
    const a = byId.get(ia);
    const b = byId.get(ib);
    const ma = this.memory.get(ia);
    const mb = this.memory.get(ib);
    if (!a || !b || !ma?.grab || !mb?.grab) {
      // A member vanished earlier this frame; leaveSession already ran.
      this.sessions.delete(s.objectId);
      return;
    }

    // A tracked hand whose pinch ended lets go and leaves the grab.
    const letGo = (p: PointerInput) =>
      p.status === 'tracking' && (p.pinch.ended || !p.pinch.active);
    const aGone = letGo(a);
    const bGone = letGo(b);
    if (aGone || bGone) {
      this.sessions.delete(s.objectId);
      for (const [p, m, gone] of [
        [a, ma, aGone],
        [b, mb, bGone],
      ] as const) {
        if (gone) {
          m.grab = null;
          m.releasedAt = now;
          const hoverId = p.inBox ? scene.pick(p.screen) : null;
          pointers.push(this.pointer(p, hoverId ? 'hovering' : 'tracking', hoverId, m));
        } else {
          m.grab =
            p.status === 'tracking'
              ? this.anchor(s.objectId, s.pose.position, p, scene)
              : { ...m.grab!, last: [...s.pose.position] };
          held.set(s.objectId, p.id);
          pointers.push(this.pointer(p, p.status === 'lost' ? 'lost' : 'grabbing', null, m));
        }
      }
      if (aGone && bGone) held.delete(s.objectId);
      return;
    }

    const aOn = a.status === 'tracking';
    const bOn = b.status === 'tracking';
    const driver: TwoHandSession['driver'] = aOn && bOn ? 'two' : aOn ? ia : bOn ? ib : 'none';
    const paused = driver === 'two' && !!(a.pinch.releasing || b.pinch.releasing);
    const rebase = driver !== s.driver || (s.paused && !paused);

    if (driver === 'two') {
      const view = scene.view?.() ?? DEFAULT_VIEW;
      if (rebase || !s.grip) s.planeOrigin = [...s.pose.position];
      const origin = s.planeOrigin;
      const ga = scene.planePoint(a.screen, origin);
      const gb = scene.planePoint(b.screen, origin);
      const ta = a.tip && scene.planePoint(a.tip, origin);
      const tb = b.tip && scene.planePoint(b.tip, origin);
      const span = ta && tb ? ([ta, tb] as const) : undefined;
      const palms = a.palm && b.palm ? ([a.palm, b.palm] as const) : undefined;
      if (ga && gb) {
        if (rebase || !s.grip) {
          if (s.grip) s.grip.rebase(s.pose, ga, gb, now, span, palms);
          else
            s.grip = new BimanualGrip(
              s.pose,
              ga,
              gb,
              view,
              now,
              { depthGain: this.options.twoHandDepth ? TWO_HAND_DEPTH_GAIN : 0 },
              span,
              palms,
            );
        }
        if (!paused) {
          const r = s.grip.update(ga, gb, now, span, palms);
          const position = clampPosition(r.position);
          const moved =
            Math.hypot(
              position[0] - s.pose.position[0],
              position[1] - s.pose.position[1],
              position[2] - s.pose.position[2],
            ) > MOVE_EPSILON ||
            Math.abs(r.scale - s.pose.scale) > 1e-6 ||
            r.rotation.some((v, i) => Math.abs(v - s.pose.rotation[i]!) > 1e-7);
          if (moved) {
            s.pose = { position, rotation: r.rotation, scale: r.scale };
            commands.push({
              type: 'setTransform',
              id: s.objectId,
              position,
              rotation: r.rotation,
              scale: r.scale,
            });
          }
          s.info = {
            ...s.info,
            scaleFactor: r.scaleFactor,
            spread: r.spread,
            turn: r.turn,
            depth: r.depth,
            roll: r.roll,
            scale: r.scale,
            atLimit: r.atLimit,
            holding: r.holding,
          };
        }
      }
    } else if (driver !== 'none') {
      const p = driver === ia ? a : b;
      const m = driver === ia ? ma : mb;
      if (rebase) m.grab = this.anchor(s.objectId, s.pose.position, p, scene);
      this.moveOneHand(p, m.grab!, scene, commands);
      s.pose = { ...s.pose, position: clampPosition(m.grab!.last) };
    }

    // Keep both members' grab state pointing at the latest pose, so whichever
    // hand ends up alone re-anchors from the right place.
    ma.grab.last = [...s.pose.position];
    mb.grab.last = [...s.pose.position];
    s.driver = driver;
    s.paused = paused;
    s.info = {
      ...s.info,
      mode: driver === 'two' ? 'two' : driver === 'none' ? 'frozen' : 'one',
      lostId: !aOn ? ia : !bOn ? ib : null,
    };
    held.set(s.objectId, ia);
    for (const [p, m] of [
      [a, ma],
      [b, mb],
    ] as const) {
      pointers.push(this.pointer(p, p.status === 'lost' ? 'lost' : 'grabbing', null, m));
    }
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
      tip: input.tip,
      pinchStrength: input.pinch.strength,
      pinchRatio: input.pinch.ratio,
      inBox: input.inBox,
      hoverId,
      grabbedId: m.grab?.objectId ?? null,
      releasedAt: m.releasedAt,
    };
  }
}
