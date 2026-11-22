import type { SceneObject } from '@/core/interaction/commands';
import { handsInView, sequence, type Objective } from '@/core/objectives/objectives';
import type { Keyframe } from '@/core/tracking/scripts';
import type { Handedness } from '@/core/vision/types';

/**
 * Practice lessons. Each one sets up its own scene, shows a demo hand, and
 * passes when its objective does. Thresholds are deliberately forgiving: the
 * point is to learn the gesture, not to pass a test.
 */
export interface Lesson {
  id: string;
  title: string;
  /** One or two short sentences. */
  instruction: string;
  /** Demo hand motion, raw camera coordinates (see scriptedRecording). */
  demo: { keys: Keyframe[]; handedness: Handedness };
  /** Scene objects for the lesson (fresh copies each call). */
  scene: () => SceneObject[];
  objective: () => Objective;
  /** Shown in the list but not needed to finish Practice. */
  optional?: boolean;
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'hands',
    title: 'Show your hands',
    instruction: 'Raise one hand so the camera sees it, then both. Keep them inside the frame.',
    demo: {
      handedness: 'Right',
      keys: [
        { at: 0, cx: 0.45, cy: 0.95, pinch: 0, visible: false },
        { at: 300, cx: 0.45, cy: 0.85, pinch: 0 },
        { at: 1100, cx: 0.45, cy: 0.5, pinch: 0 },
        { at: 1600, cx: 0.45, cy: 0.5, pinch: 0 },
      ],
    },
    scene: () => [],
    objective: () => sequence([handsInView(1, 1500), handsInView(2, 1500)]),
  },
];

/** Lessons needed to finish Practice. */
export const REQUIRED_LESSONS = LESSONS.filter((l) => !l.optional);
