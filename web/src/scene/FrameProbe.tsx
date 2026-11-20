import { useFrame } from '@react-three/fiber';
import { useEffect } from 'react';
import { renderStats } from '@/lib/telemetry/renderStats';

/** Feeds real render timings into the telemetry module. Renders nothing. */
export function FrameProbe() {
  useEffect(() => () => renderStats.reset(), []);
  useFrame(() => renderStats.frame(performance.now()));
  return null;
}
