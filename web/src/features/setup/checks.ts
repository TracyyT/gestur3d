import { distanceStatus, lightingStatus } from '@/core/vision/calibration';
import type { TrackingStatus, TrackingSummary } from '@/features/camera/useHandTracking';
import type { CheckItem } from './CalibrationChecklist';

/** Derive the calibration checklist from tracking state. Pure, so it's unit-tested. */
export function buildChecks(
  tracking: TrackingStatus,
  summary: TrackingSummary,
  luminance: number | null,
): CheckItem[] {
  const n = summary.hands.length;
  const ready = tracking === 'ready';

  const handsCheck: CheckItem = {
    id: 'hands',
    label: 'Hands detected',
    state: !ready ? 'pending' : n === 2 ? 'pass' : 'fail',
    detail: !ready
      ? tracking === 'error'
        ? 'Hand tracking is unavailable.'
        : 'Loading hand tracking…'
      : n === 0
        ? 'Raise both hands, palms toward the camera.'
        : n === 1
          ? `Got your ${summary.hands[0]!.handedness.toLowerCase()} hand. Now raise the other one too.`
          : 'Both hands found.',
  };

  const largest = summary.hands.reduce((m, h) => Math.max(m, h.palm), 0);
  const dist = n ? distanceStatus(largest) : null;
  const distanceCheck: CheckItem = {
    id: 'distance',
    label: 'Distance',
    state: dist === null ? 'pending' : dist === 'good' ? 'pass' : 'fail',
    detail:
      dist === null
        ? 'Measured once a hand is visible.'
        : dist === 'good'
          ? 'About an arm’s length. Perfect.'
          : dist === 'too-far'
            ? 'Move a little closer to the camera.'
            : 'Move back a little.',
  };

  const light = luminance === null ? null : lightingStatus(luminance);
  const lightCheck: CheckItem = {
    id: 'lighting',
    label: 'Lighting',
    state: light === null ? 'pending' : light === 'good' ? 'pass' : 'fail',
    detail:
      light === null
        ? 'Checking…'
        : light === 'good'
          ? 'Your hands should be clearly visible.'
          : light === 'dark'
            ? 'Too dark. Face a window or turn on a light.'
            : 'Very bright. Avoid a bright light directly behind you.',
  };

  return [handsCheck, distanceCheck, lightCheck];
}
