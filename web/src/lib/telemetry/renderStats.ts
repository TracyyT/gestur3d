import { RateMeter } from '@/core/vision/rateMeter';

/**
 * Render-loop telemetry. The 3D frame loop writes here every frame without
 * touching React; the HUD samples it a few times per second.
 */
const meter = new RateMeter(1000);
let lastFrameAt = 0;
let drawCalls = 0;
let triangles = 0;

export const renderStats = {
  /** Call once per rendered frame with performance.now(). */
  frame(now: number) {
    const dt = lastFrameAt ? now - lastFrameAt : 0;
    lastFrameAt = now;
    meter.tick(now, dt || undefined);
  },
  /** Draw calls and triangles of the last whole frame (all passes). */
  gpu(calls: number, tris: number) {
    drawCalls = calls;
    triangles = tris;
  },
  snapshot(now = performance.now()) {
    return { fps: meter.rate(now), frameMs: meter.meanDuration(), drawCalls, triangles };
  },
  reset() {
    meter.reset();
    lastFrameAt = 0;
    drawCalls = 0;
    triangles = 0;
  },
};
