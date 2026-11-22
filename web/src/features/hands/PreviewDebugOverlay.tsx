import { useEffect, useRef } from 'react';
import { interactionBox } from '@/core/interaction/handMapping';
import type { HandFrame } from '@/core/vision/types';
import { HandOverlay } from '@/features/camera/HandOverlay';
import { visibleSceneRect } from '@/scene/framing';
import { useHudLayout } from '@/stores/hudLayout';
import { useSettings } from '@/stores/settings';
import { useHandTracking } from './handTrackingStore';

/**
 * Debug layer for the camera preview: hand skeletons plus the interaction
 * box (the part of the camera view that maps onto the scene). Render inside
 * the same mirrored container as the preview video, using raw coordinates.
 */
export function PreviewDebugOverlay() {
  const source = useHandTracking((s) => s.source);
  const aspect = useHandTracking((s) => s.cameraAspect);
  const reach = useSettings((s) => s.handReach);
  const panels = useHudLayout((s) => s.panelsVisible);
  const latest = useRef<HandFrame | null>(null);

  useEffect(() => {
    if (!source) return;
    const unsubscribe = source.subscribe((f) => {
      latest.current = f;
    });
    return () => {
      unsubscribe();
      latest.current = null;
    };
  }, [source]);

  const leftInset = useHudLayout((s) => s.leftInset);
  const rect = visibleSceneRect(panels, window.innerWidth, window.innerHeight, leftInset);
  const box = interactionBox(reach, aspect, rect.width / rect.height);

  return (
    <>
      <div
        aria-hidden
        className="absolute rounded-sm border border-dashed border-holo-cyan/70"
        style={{
          left: `${box.x0 * 100}%`,
          top: `${box.y0 * 100}%`,
          width: `${(box.x1 - box.x0) * 100}%`,
          height: `${(box.y1 - box.y0) * 100}%`,
        }}
      />
      <HandOverlay latest={latest} className="absolute inset-0 size-full" />
    </>
  );
}
