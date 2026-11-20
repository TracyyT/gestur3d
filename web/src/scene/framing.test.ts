import { describe, expect, it } from 'vitest';
import { PANEL_COVER_PX, computeFraming } from './PanelAwareFraming';

describe('computeFraming', () => {
  it('shifts by half the covered width when panels are open on wide screens', () => {
    expect(computeFraming(true, 1440, 900).offsetX).toBe(PANEL_COVER_PX / 2);
  });

  it('does not shift when panels are hidden or the screen is narrow', () => {
    expect(computeFraming(false, 1440, 900).offsetX).toBe(0);
    expect(computeFraming(true, 800, 900).offsetX).toBe(0);
  });

  it('keeps full size when the free area is wide enough', () => {
    expect(computeFraming(true, 1440, 900).zoom).toBe(1);
    expect(computeFraming(false, 1280, 800).zoom).toBe(1);
  });

  it('zooms out to fit when the free area is narrow', () => {
    // ~950×920 window (DevTools docked): 638 px free for a layout needing ~920 px.
    const { zoom } = computeFraming(true, 950, 920);
    expect(zoom).toBeCloseTo(638 / 920, 3);
    expect(zoom).toBeLessThan(1);
  });

  it('never zooms out past the minimum', () => {
    expect(computeFraming(false, 300, 1000).zoom).toBe(0.55);
  });
});
