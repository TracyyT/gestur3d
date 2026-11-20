import { MEDIAPIPE_BASE, MainThreadHandSource } from '@/core/vision/mediapipeHands';
import type { RateMeter } from '@/core/vision/rateMeter';
import type { HandSource } from '@/core/vision/types';
import { WorkerHandSource } from '@/core/vision/workerHandSource';
import type { TrackingBackendPreference } from '@/stores/settings';
import { getHandLandmarker } from './handLandmarkerLoader';

export interface LiveHandSource extends HandSource {
  readonly stats: RateMeter;
  delegate: 'GPU' | 'CPU' | null;
}

const workerSupported = () =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';

/**
 * Start live hand detection on `video`. "auto" tries the worker first and
 * falls back to the main thread if the worker can't start on this browser.
 */
export async function createLiveHandSource(
  video: HTMLVideoElement,
  preference: TrackingBackendPreference,
): Promise<LiveHandSource> {
  if (preference !== 'main-thread' && workerSupported()) {
    const worker = new WorkerHandSource(video);
    try {
      await worker.init(new URL(MEDIAPIPE_BASE, window.location.origin).href);
      return worker;
    } catch (err) {
      worker.dispose();
      if (preference === 'worker') throw err;
      console.warn('[tracking] worker unavailable, using main thread:', err);
    }
  }
  const { landmarker, delegate } = await getHandLandmarker();
  const source = new MainThreadHandSource(video, landmarker);
  source.delegate = delegate;
  return source;
}
