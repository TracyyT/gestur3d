import { create } from 'zustand';
import type { HandSource, VisionBackend } from '@/core/vision/types';

export type HandTrackingStatus = 'off' | 'starting' | 'running' | 'error';

interface HandTrackingState {
  status: HandTrackingStatus;
  source: HandSource | null;
  backend: VisionBackend | null;
  delegate: 'GPU' | 'CPU' | null;
  /** Camera width / height of the frames the source produces. */
  cameraAspect: number;
  error: string | null;
  set: (patch: Partial<Omit<HandTrackingState, 'set'>>) => void;
}

/** Which hand source the workspace is using (live camera, worker or replay). */
export const useHandTracking = create<HandTrackingState>()((set) => ({
  status: 'off',
  source: null,
  backend: null,
  delegate: null,
  cameraAspect: 16 / 9,
  error: null,
  set: (patch) => set(patch),
}));
