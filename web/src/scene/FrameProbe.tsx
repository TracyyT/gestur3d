import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type { WebGLRenderer } from 'three';
import { renderStats } from '@/lib/telemetry/renderStats';

/** Whether three resets its counters per render call (true) or only when we say. */
function setAutoReset(gl: WebGLRenderer, on: boolean) {
  gl.info.autoReset = on;
}

/** Feeds real render timings and GPU work into the telemetry module. Renders nothing. */
export function FrameProbe() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    // Count every pass (scene + bloom) per frame, not just the last one.
    setAutoReset(gl, false);
    return () => {
      setAutoReset(gl, true);
      renderStats.reset();
    };
  }, [gl]);
  useFrame(() => {
    renderStats.frame(performance.now());
    // Runs before this frame renders, so info holds the whole previous frame.
    renderStats.gpu(gl.info.render.calls, gl.info.render.triangles);
    gl.info.reset();
  });
  return null;
}
