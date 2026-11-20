import { useEffect, useRef, useState, type RefObject } from 'react';
import { HoldTracker } from '@/core/gestures/holdTracker';
import { isThumbsUp } from '@/core/gestures/rules/thumbsUp';
import type { HandFrame } from '@/core/vision/types';

const STALE_MS = 300;
export const THUMBS_UP_HOLD_MS = 1000;

/**
 * Watches the latest hand frame for a held thumbs-up and calls `onComplete`
 * once it has been held for THUMBS_UP_HOLD_MS. Returns 0..1 progress for UI.
 */
export function useThumbsUpHold(
  latest: RefObject<HandFrame | null>,
  getAspect: () => number,
  enabled: boolean,
  onComplete: () => void,
) {
  const [progress, setProgress] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!enabled) return;
    const tracker = new HoldTracker(THUMBS_UP_HOLD_MS, 200);
    let shown = 0;
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const f = latest.current;
      const fresh = f && now - f.timestamp < STALE_MS ? f : null;
      const aspect = getAspect();
      const active = !!fresh?.hands.some((h) => isThumbsUp(h.image, aspect));
      const { progress: p, completed } = tracker.update(now, active);
      // Only re-render on visible changes.
      if (Math.abs(p - shown) > 0.02 || (p === 0 && shown !== 0)) {
        shown = p;
        setProgress(p);
      }
      if (completed) onCompleteRef.current();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setProgress(0);
    };
  }, [latest, getAspect, enabled]);

  return progress;
}
