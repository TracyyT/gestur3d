import { describe, expect, it } from 'vitest';
import { renderStats } from '@/lib/telemetry/renderStats';
import { clampToViewport } from './hudLayout';

describe('clampToViewport', () => {
  const size = { w: 200, h: 150 };
  const vp = { w: 1000, h: 800 };

  it('keeps a box inside the viewport with a margin', () => {
    expect(clampToViewport({ x: -50, y: -50 }, size, vp)).toEqual({ x: 12, y: 12 });
    expect(clampToViewport({ x: 5000, y: 5000 }, size, vp)).toEqual({ x: 788, y: 638 });
  });

  it('leaves in-bounds positions alone', () => {
    expect(clampToViewport({ x: 300, y: 200 }, size, vp)).toEqual({ x: 300, y: 200 });
  });

  it('pins to the margin when the viewport is smaller than the box', () => {
    expect(clampToViewport({ x: 100, y: 100 }, size, { w: 150, h: 100 })).toEqual({ x: 12, y: 12 });
  });
});

describe('renderStats', () => {
  it('reports frame rate and frame time from frame timestamps', () => {
    renderStats.reset();
    for (let i = 0; i <= 60; i++) renderStats.frame(i * (1000 / 60));
    const { fps, frameMs } = renderStats.snapshot(1000);
    expect(fps).toBeCloseTo(60, 0);
    expect(frameMs).toBeCloseTo(16.67, 1);
  });

  it('respects a larger top inset', () => {
    const size = { w: 200, h: 100 };
    const vp = { w: 800, h: 600 };
    expect(clampToViewport({ x: 0, y: 0 }, size, vp, 12, 64)).toEqual({ x: 12, y: 64 });
  });
});
