import { describe, expect, it } from 'vitest';
import { PANEL_COVER_PX, framingOffset } from './PanelAwareFraming';

describe('framingOffset', () => {
  it('shifts by half the covered width when panels are open on wide screens', () => {
    expect(framingOffset(true, 1440)).toBe(PANEL_COVER_PX / 2);
  });
  it('does not shift when panels are hidden or the screen is narrow', () => {
    expect(framingOffset(false, 1440)).toBe(0);
    expect(framingOffset(true, 800)).toBe(0);
  });
});
