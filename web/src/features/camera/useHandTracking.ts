import { useEffect, useRef, useState, type RefObject } from 'react';
import { palmSize } from '@/core/vision/calibration';
import { MainThreadHandSource, type Delegate } from '@/core/vision/mediapipeHands';
import type { HandFrame, Handedness } from '@/core/vision/types';
import { getHandLandmarker } from './handLandmarkerLoader';

export type TrackingStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface TrackingSummary {
  hands: Array<{ handedness: Handedness; score: number; palm: number }>;
  detectionFps: number;
  detectionMs: number;
}

const EMPTY: TrackingSummary = { hands: [], detectionFps: 0, detectionMs: 0 };
/** UI readouts refresh at this rate; per-frame data stays in `latest`. */
const SUMMARY_HZ = 8;

/**
 * Runs hand detection on a playing <video>. Per-frame landmarks go into a ref
 * (for canvas drawing); React state only gets a throttled summary.
 */
export function useHandTracking(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const latest = useRef<HandFrame | null>(null);
  const [status, setStatus] = useState<TrackingStatus>('idle');
  const [delegate, setDelegate] = useState<Delegate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TrackingSummary>(EMPTY);

  useEffect(() => {
    const video = videoRef.current;
    if (!enabled || !video) return;

    let source: MainThreadHandSource | null = null;
    let timer: number | undefined;
    let cancelled = false;
    setStatus('loading');
    setError(null);

    getHandLandmarker()
      .then(({ landmarker, delegate: d }) => {
        if (cancelled) return;
        source = new MainThreadHandSource(video, landmarker);
        source.subscribe((frame) => {
          latest.current = frame;
        });
        source.start();
        setDelegate(d);
        setStatus('ready');

        const aspect = () =>
          video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
        timer = window.setInterval(() => {
          const f = latest.current;
          const now = performance.now();
          // Treat landmarks older than 300 ms as "no hands" (tracking lost).
          const fresh = f && now - f.timestamp < 300 ? f : null;
          setSummary({
            hands: (fresh?.hands ?? []).map((h) => ({
              handedness: h.handedness,
              score: h.handednessScore,
              palm: palmSize(h, aspect()),
            })),
            detectionFps: source?.stats.rate(now) ?? 0,
            detectionMs: source?.stats.meanDuration() ?? 0,
          });
        }, 1000 / SUMMARY_HZ);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      source?.dispose();
      latest.current = null;
      setSummary(EMPTY);
      setStatus('idle');
    };
  }, [enabled, videoRef]);

  return { status, delegate, error, summary, latest };
}
