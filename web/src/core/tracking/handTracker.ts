import {
  HandLandmark as L,
  type HandFrame,
  type Handedness,
  type TrackedHand,
} from '@/core/vision/types';
import { OneEuroVec, smoothingToParams, type OneEuroParams } from './oneEuro';
import {
  PinchDetector,
  pinchRatio,
  sensitivityToThresholds,
  type PinchState,
  type PinchThresholds,
} from './pinch';

export type AnchorMode = 'pinch' | 'knuckle' | 'blend';

/**
 * The point on the hand that drives the cursor, in raw camera-normalized
 * coordinates (unmirrored, 0..1).
 * - pinch:   midpoint of thumb tip and index tip (moves as the pinch closes)
 * - knuckle: midpoint of thumb MCP and index MCP (stable while pinching)
 * - blend:   halfway between the two
 */
export function anchorPoint(image: ArrayLike<number>, mode: AnchorMode): [number, number] {
  const mid = (a: number, b: number): [number, number] => [
    (image[a * 3]! + image[b * 3]!) / 2,
    (image[a * 3 + 1]! + image[b * 3 + 1]!) / 2,
  ];
  const tip = mid(L.ThumbTip, L.IndexTip);
  if (mode === 'pinch') return tip;
  const knuckle = mid(L.ThumbMcp, L.IndexMcp);
  if (mode === 'knuckle') return knuckle;
  return [(tip[0] + knuckle[0]) / 2, (tip[1] + knuckle[1]) / 2];
}

export type TrackStatus = 'tracking' | 'lost';

export interface TrackSnapshot {
  id: number;
  handedness: Handedness;
  status: TrackStatus;
  /** Smoothed anchor, raw camera-normalized coordinates (unmirrored). */
  anchor: [number, number];
  /** Unsmoothed anchor from the latest detection. */
  rawAnchor: [number, number];
  pinch: PinchState;
  /** Timestamp (ms) of the last detection that included this hand. */
  lastSeen: number;
  /** When the hand went missing, if it's currently lost. */
  lostSince: number | null;
}

export interface HandTrackerOptions {
  smoothing: number;
  sensitivity: number;
  anchorMode: AnchorMode;
  /** How long a missing hand is kept (status `lost`) before it's dropped. */
  lostGraceMs: number;
}

export const DEFAULT_TRACKER_OPTIONS: HandTrackerOptions = {
  smoothing: 0.5,
  sensitivity: 0.5,
  anchorMode: 'blend',
  lostGraceMs: 300,
};

interface Track {
  id: number;
  handedness: Handedness;
  status: TrackStatus;
  filter: OneEuroVec;
  pinchDetector: PinchDetector;
  anchor: [number, number];
  rawAnchor: [number, number];
  pinch: PinchState;
  lastSeen: number;
  lostSince: number | null;
}

const NO_PINCH: PinchState = { strength: 0, active: false, started: false, ended: false };

/**
 * Max distance (camera-normalized, aspect-corrected) a hand can plausibly move
 * between two detections `dtMs` apart. Anything farther is treated as a
 * different hand (e.g. MediaPipe swapping hands), not a sudden jump.
 */
export function maxPlausibleMove(dtMs: number) {
  return Math.min(0.35, 0.08 + 3.0 * (Math.max(0, dtMs) / 1000));
}

/**
 * Keeps a stable identity per physical hand across frames, smooths its
 * anchor, runs its pinch detector, and handles tracking loss:
 * a hand missing from a frame becomes `lost` and is kept for `lostGraceMs`,
 * so it can be re-acquired without the cursor (or a held object) jumping.
 */
export class HandTracker {
  private tracks: Track[] = [];
  private nextId = 1;
  private options: HandTrackerOptions;
  private params: OneEuroParams;
  private thresholds: PinchThresholds;

  constructor(options: Partial<HandTrackerOptions> = {}) {
    this.options = { ...DEFAULT_TRACKER_OPTIONS, ...options };
    this.params = smoothingToParams(this.options.smoothing);
    this.thresholds = sensitivityToThresholds(this.options.sensitivity);
  }

  configure(options: Partial<HandTrackerOptions>) {
    this.options = { ...this.options, ...options };
    this.params = smoothingToParams(this.options.smoothing);
    this.thresholds = sensitivityToThresholds(this.options.sensitivity);
    for (const t of this.tracks) {
      t.filter.setParams(this.params);
      t.pinchDetector.thresholds = this.thresholds;
    }
  }

  /** Feed one detection frame. `aspect` = camera width / height. */
  update(frame: HandFrame, aspect: number): TrackSnapshot[] {
    const now = frame.timestamp;
    const detections = frame.hands.map((hand) => ({
      hand,
      raw: anchorPoint(hand.image, this.options.anchorMode),
    }));
    const claimed = new Set<Track>();

    // Greedy nearest match, same handedness only, closest pairs first.
    const pairs: Array<{ d: number; det: number; track: Track }> = [];
    detections.forEach((det, i) => {
      for (const track of this.tracks) {
        if (track.handedness !== det.hand.handedness) continue;
        const dist = Math.hypot(
          (det.raw[0] - track.rawAnchor[0]) * aspect,
          det.raw[1] - track.rawAnchor[1],
        );
        if (dist <= maxPlausibleMove(now - track.lastSeen)) pairs.push({ d: dist, det: i, track });
      }
    });
    pairs.sort((a, b) => a.d - b.d);
    const matched = new Map<number, Track>();
    for (const p of pairs) {
      if (matched.has(p.det) || claimed.has(p.track)) continue;
      matched.set(p.det, p.track);
      claimed.add(p.track);
    }

    detections.forEach((det, i) => {
      let track = matched.get(i);
      if (!track) {
        track = this.createTrack(det.hand.handedness);
        claimed.add(track);
      }
      this.applyDetection(track, det.hand, det.raw, now, aspect);
    });

    for (const track of this.tracks) {
      if (claimed.has(track)) continue;
      if (track.status === 'tracking') {
        track.status = 'lost';
        track.lostSince = now;
        track.pinch = { ...track.pinch, started: false, ended: false };
      }
    }
    return this.expire(now);
  }

  /** Drop hands lost for longer than the grace period. Call every frame. */
  expire(now: number): TrackSnapshot[] {
    this.tracks = this.tracks.filter(
      (t) =>
        t.status === 'tracking' ||
        (t.lostSince !== null && now - t.lostSince <= this.options.lostGraceMs),
    );
    return this.snapshot();
  }

  snapshot(): TrackSnapshot[] {
    return this.tracks.map((t) => ({
      id: t.id,
      handedness: t.handedness,
      status: t.status,
      anchor: t.anchor,
      rawAnchor: t.rawAnchor,
      pinch: t.pinch,
      lastSeen: t.lastSeen,
      lostSince: t.lostSince,
    }));
  }

  reset() {
    this.tracks = [];
  }

  private createTrack(handedness: Handedness): Track {
    const track: Track = {
      id: this.nextId++,
      handedness,
      status: 'tracking',
      filter: new OneEuroVec(2, this.params),
      pinchDetector: new PinchDetector(this.thresholds),
      anchor: [0, 0],
      rawAnchor: [0, 0],
      pinch: NO_PINCH,
      lastSeen: 0,
      lostSince: null,
    };
    this.tracks.push(track);
    return track;
  }

  private applyDetection(
    track: Track,
    hand: TrackedHand,
    raw: [number, number],
    now: number,
    aspect: number,
  ) {
    const [x, y] = track.filter.filter(raw, now);
    track.anchor = [x!, y!];
    track.rawAnchor = raw;
    track.pinch = track.pinchDetector.update(pinchRatio(hand.world, hand.image, aspect), now);
    track.lastSeen = now;
    track.status = 'tracking';
    track.lostSince = null;
  }
}
