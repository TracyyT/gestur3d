import { useEffect, useState, type RefObject } from 'react';
import { meanLuminance } from '@/core/vision/calibration';

/** Samples the video's average brightness a couple of times per second (64×36 downscale). */
export function useFrameLuminance(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean) {
  const [luminance, setLuminance] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 36;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!ctx || !v || v.readyState < 2) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      setLuminance(meanLuminance(ctx.getImageData(0, 0, canvas.width, canvas.height).data, 1));
    }, 500);
    return () => {
      window.clearInterval(id);
      setLuminance(null);
    };
  }, [enabled, videoRef]);

  return luminance;
}
