import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@/core/interaction/commands';
import { catmullRom, simplify, STROKE, StrokeBuilder } from './strokeBuilder';

const pt = (x: number, y: number) => ({
  screen: { x: x * 100, y: y * 100 },
  world: [x, y, 0] as Vec3,
});

describe('StrokeBuilder', () => {
  it('skips points closer than the minimum step, so holding still adds nothing', () => {
    const b = new StrokeBuilder(0);
    expect(b.add(pt(0, 0))).toBe(true);
    expect(b.add(pt(0.01, 0))).toBe(false); // 1 px
    expect(b.add(pt(0.05, 0))).toBe(true); // 5 px
    expect(b.points).toHaveLength(2);
  });

  it('treats short or quick pinches as taps', () => {
    const quick = new StrokeBuilder(0);
    quick.add(pt(0, 0));
    quick.add(pt(1, 0));
    expect(quick.finish(50)).toBeNull();
    const tiny = new StrokeBuilder(0);
    tiny.add(pt(0, 0));
    tiny.add(pt(0.05, 0));
    expect(tiny.finish(500)).toBeNull();
  });

  it('caps the number of points', () => {
    const b = new StrokeBuilder(0);
    for (let i = 0; i < STROKE.maxPoints + 50; i++) b.add(pt(i * 0.05, 0));
    expect(b.points).toHaveLength(STROKE.maxPoints);
  });

  it('smooths and simplifies a circle into far fewer points that stay on it', () => {
    const b = new StrokeBuilder(0);
    for (let i = 0; i <= 200; i++) {
      const a = (i / 200) * Math.PI * 2;
      b.add(pt(Math.cos(a), Math.sin(a)));
    }
    const out = b.finish(1000)!;
    expect(out.length).toBeLessThan(b.points.length);
    expect(out.length).toBeGreaterThan(20);
    for (const p of out) expect(Math.hypot(p[0], p[1])).toBeCloseTo(1, 1);
    expect(out[0]).toEqual([1, 0, 0]);
  });
});

describe('stroke helpers', () => {
  it('Catmull-Rom passes through the original points', () => {
    const pts: Vec3[] = [
      [0, 0, 0],
      [1, 1, 0],
      [2, 0, 0],
      [3, 1, 0],
    ];
    const out = catmullRom(pts, 4);
    expect(out).toHaveLength((pts.length - 1) * 4 + 1);
    for (let i = 0; i < pts.length; i++) expect(out[i * 4]).toEqual(pts[i]);
  });

  it('simplify keeps the ends and drops collinear points', () => {
    const line: Vec3[] = Array.from({ length: 20 }, (_, i) => [i, 0, 0]);
    expect(simplify(line, 0.01)).toEqual([
      [0, 0, 0],
      [19, 0, 0],
    ]);
    const corner: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [2, 1, 0],
      [2, 2, 0],
    ];
    expect(simplify(corner, 0.01)).toEqual([
      [0, 0, 0],
      [2, 0, 0],
      [2, 2, 0],
    ]);
  });
});
