import { RateMeter } from '@/core/vision/rateMeter';

/**
 * Render-loop telemetry. The 3D frame loop writes here every frame without
 * touching React; the HUD samples it a few times per second.
 */
const meter = new RateMeter(1000);
let lastFrameAt = 0;

export const renderStats = {
  /** Call once per rendered frame with performance.now(). */
  frame(now: number) {
    const dt = lastFrameAt ? now - lastFrameAt : 0;
    lastFrameAt = now;
    meter.tick(now, dt || undefined);
  },
  snapshot(now = performance.now()) {
    return { fps: meter.rate(now), frameMs: meter.meanDuration() };
  },
  reset() {
    meter.reset();
    lastFrameAt = 0;
  },
};
