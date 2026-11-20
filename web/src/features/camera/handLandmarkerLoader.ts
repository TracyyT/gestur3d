import { loadHandLandmarker, type LoadedHandLandmarker } from '@/core/vision/mediapipeHands';

let pending: Promise<LoadedHandLandmarker> | null = null;

/** Load the Hand Landmarker once per page and share it. Retries after a failure. */
export function getHandLandmarker(): Promise<LoadedHandLandmarker> {
  if (!pending) {
    pending = loadHandLandmarker(2).catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}
