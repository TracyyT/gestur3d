import { describe, expect, it } from 'vitest';
import { hitTest, MENU_ACTIONS, MENU_GEOMETRY, outerAngle, screenAngle } from './radialMenu';

const at = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [Math.sin(a) * r, -Math.cos(a) * r] as const;
};

describe('radial menu hit testing', () => {
  it('measures angles from the top, clockwise', () => {
    expect(screenAngle(0, -10)).toBeCloseTo(0);
    expect(screenAngle(10, 0)).toBeCloseTo(Math.PI / 2);
    expect(screenAngle(-10, 0)).toBeCloseTo((3 * Math.PI) / 2);
  });

  it('highlights nothing in the center dead zone', () => {
    expect(hitTest(5, -5, null)).toEqual({ ring: 'none' });
  });

  it('picks the six inner sectors by direction', () => {
    MENU_ACTIONS.forEach((_, i) => {
      expect(hitTest(...at(i * 60, 80), null)).toEqual({ ring: 'inner', index: i });
      expect(hitTest(...at(i * 60 + 25, 80), null)).toEqual({ ring: 'inner', index: i });
    });
  });

  it('keeps the inner sector when overshooting with no outer ring', () => {
    expect(hitTest(...at(120, 300), null)).toEqual({ ring: 'inner', index: 2 });
  });

  it('picks outer items when an outer ring is open', () => {
    const nine = { parent: 0, count: 9 };
    for (let j = 0; j < 9; j++) {
      const deg = (outerAngle(0, j, 9) * 180) / Math.PI;
      expect(hitTest(...at(deg, MENU_GEOMETRY.innerOuter + 20), nine)).toEqual({
        ring: 'outer',
        index: j,
      });
    }
    // Inside the inner ring, the inner sectors still win.
    expect(hitTest(...at(60, 80), nine)).toEqual({ ring: 'inner', index: 1 });
  });

  it('a short outer ring fans out around its parent; elsewhere the inner sector wins', () => {
    const colors = { parent: 2, count: 3 };
    expect(hitTest(...at(120, 150), colors)).toEqual({ ring: 'outer', index: 1 });
    expect(hitTest(...at(120 - 36, 150), colors)).toEqual({ ring: 'outer', index: 0 });
    expect(hitTest(...at(300, 150), colors)).toEqual({ ring: 'inner', index: 5 });
  });

  describe('sticky highlight', () => {
    const add = { ring: 'inner', index: 0 } as const;

    it('a small drift past the edge keeps the current sector', () => {
      // Sector edges are at ±30°; the highlight holds to ±43.5°.
      expect(hitTest(...at(35, 80), null, add)).toEqual(add);
      expect(hitTest(...at(-40, 80), null, add)).toEqual(add);
    });

    it('moving clearly into a neighbor switches', () => {
      expect(hitTest(...at(46, 80), null, add)).toEqual({ ring: 'inner', index: 1 });
      expect(hitTest(...at(-46, 80), null, add)).toEqual({ ring: 'inner', index: 5 });
    });

    it('without a current highlight, the plain edges apply', () => {
      expect(hitTest(...at(35, 80), null)).toEqual({ ring: 'inner', index: 1 });
    });

    it('outer items stick too, and dipping just inside the inner ring keeps them', () => {
      const nine = { parent: 0, count: 9 };
      const item0 = { ring: 'outer', index: 0 } as const;
      // Outer items are 40° wide: edges at ±20°, sticky to ±29°.
      expect(hitTest(...at(25, MENU_GEOMETRY.innerOuter + 20), nine, item0)).toEqual(item0);
      expect(hitTest(...at(0, MENU_GEOMETRY.innerOuter - 8), nine, item0)).toEqual(item0);
      expect(hitTest(...at(32, MENU_GEOMETRY.innerOuter + 20), nine, item0)).toEqual({
        ring: 'outer',
        index: 1,
      });
    });

    it('the center needs a deeper return to cancel once something is highlighted', () => {
      const r = MENU_GEOMETRY.deadZone * 0.85;
      expect(hitTest(...at(0, r), null)).toEqual({ ring: 'none' });
      expect(hitTest(...at(0, r), null, add)).toEqual(add);
    });
  });
});
