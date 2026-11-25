import { describe, expect, it } from 'vitest';
import {
  cameraToScreen,
  extendBox,
  interactionBox,
  screenToCamera,
  screenToNdc,
} from './handMapping';

const CAM = 16 / 9;
const PANEL = 312;

/** Visible scene rect for a window, same rule as scene/framing. */
const sceneRect = (w: number, h: number, panels: boolean) => ({
  left: 0,
  top: 0,
  width: panels && w >= 900 ? w - PANEL : w,
  height: h,
});

const WINDOWS: Array<[string, number, number, boolean]> = [
  ['1440×900, panels open', 1440, 900, true],
  ['1440×900, panels hidden', 1440, 900, false],
  ['950×920, panels open', 950, 920, true],
  ['700×900, panels (overlay)', 700, 900, true],
  ['2560×1440, panels open', 2560, 1440, true],
];

describe('interactionBox', () => {
  it('is centered and matches the target aspect (in camera pixels)', () => {
    for (const target of [0.7, 1, 1.6, 2.4]) {
      const b = interactionBox(0.7, CAM, target);
      expect((b.x0 + b.x1) / 2).toBeCloseTo(0.5);
      expect((b.y0 + b.y1) / 2).toBeCloseTo(0.5);
      const aspectPx = ((b.x1 - b.x0) * CAM) / (b.y1 - b.y0);
      expect(aspectPx).toBeCloseTo(target, 5);
    }
  });

  it('never exceeds the reach fraction of the frame', () => {
    const b = interactionBox(0.7, CAM, 1.6);
    expect(b.x1 - b.x0).toBeLessThanOrEqual(0.7 + 1e-9);
    expect(b.y1 - b.y0).toBeLessThanOrEqual(0.7 + 1e-9);
  });
});

describe('cameraToScreen', () => {
  it.each(WINDOWS)('%s: box center → rect center, corners → rect corners', (_n, w, h, panels) => {
    const rect = sceneRect(w, h, panels);
    const box = interactionBox(0.7, CAM, rect.width / rect.height);
    const c = cameraToScreen([0.5, 0.5], box, rect);
    expect(c.x).toBeCloseTo(rect.width / 2);
    expect(c.y).toBeCloseTo(rect.height / 2);
    // Raw x0 is the camera's left = the user's right after mirroring → screen right.
    const tl = cameraToScreen([box.x1, box.y0], box, rect);
    const br = cameraToScreen([box.x0, box.y1], box, rect);
    expect(tl.x).toBeCloseTo(0);
    expect(tl.y).toBeCloseTo(0);
    expect(br.x).toBeCloseTo(rect.width);
    expect(br.y).toBeCloseTo(rect.height);
  });

  it.each(WINDOWS)('%s: equal hand motion → equal screen motion in x and y', (_n, w, h, panels) => {
    const rect = sceneRect(w, h, panels);
    const box = interactionBox(0.7, CAM, rect.width / rect.height);
    const d = 0.05; // in frame-height units
    const o = cameraToScreen([0.5, 0.5], box, rect);
    const dx = cameraToScreen([0.5 - d / CAM, 0.5], box, rect).x - o.x;
    const dy = cameraToScreen([0.5, 0.5 + d], box, rect).y - o.y;
    expect(dx).toBeCloseTo(dy, 6);
  });

  it('mirrors: moving the hand toward the camera’s left moves the cursor right', () => {
    const rect = sceneRect(1440, 900, true);
    const box = interactionBox(0.7, CAM, rect.width / rect.height);
    const a = cameraToScreen([0.55, 0.5], box, rect);
    const b = cameraToScreen([0.45, 0.5], box, rect);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it('never maps into the panel strip, and flags out-of-box hands', () => {
    const rect = sceneRect(1440, 900, true);
    const box = interactionBox(0.7, CAM, rect.width / rect.height);
    const p = cameraToScreen([0.0, 0.5], box, rect);
    expect(p.x).toBe(rect.width);
    expect(p.x).toBeLessThanOrEqual(1440 - PANEL);
    expect(p.inBox).toBe(false);
    expect(cameraToScreen([0.5, 0.5], box, rect).inBox).toBe(true);
  });

  it('smaller reach = more cursor travel per hand movement', () => {
    const rect = sceneRect(1440, 900, false);
    const travel = (reach: number) => {
      const box = interactionBox(reach, CAM, rect.width / rect.height);
      return cameraToScreen([0.45, 0.5], box, rect).x - cameraToScreen([0.5, 0.5], box, rect).x;
    };
    expect(travel(0.5)).toBeGreaterThan(travel(0.9));
  });
});

describe('screenToNdc', () => {
  it('maps canvas corners and center', () => {
    expect(screenToNdc(0, 0, 1000, 500)).toEqual([-1, 1]);
    expect(screenToNdc(1000, 500, 1000, 500)).toEqual([1, -1]);
    expect(screenToNdc(500, 250, 1000, 500)).toEqual([0, -0]);
  });
});

describe('screenToCamera', () => {
  it('inverts cameraToScreen', () => {
    const rect = { left: 0, top: 0, width: 1128, height: 900 };
    const box = interactionBox(0.7, 16 / 9, rect.width / rect.height);
    for (const [u, v] of [
      [0.1, 0.2],
      [0.5, 0.5],
      [0.9, 0.75],
    ] as const) {
      const p = cameraToScreen(screenToCamera(u, v, box), box, rect);
      expect(p.u).toBeCloseTo(u);
      expect(p.v).toBeCloseTo(v);
    }
  });
});

describe('extendBox', () => {
  const box = interactionBox(0.7, 16 / 9, 772 / 900);
  const rect = { left: 356, top: 0, width: 772, height: 900 };
  const canvas = { left: 0, top: 0, width: 1440, height: 900 };
  const ext = extendBox(box, rect, canvas);

  it('maps points inside the scene rect exactly as before', () => {
    for (const [u, v] of [
      [0, 0],
      [0.5, 0.5],
      [1, 1],
      [0.2, 0.8],
    ] as const) {
      const raw = screenToCamera(u, v, box);
      const a = cameraToScreen(raw, box, rect);
      const b = cameraToScreen(raw, ext, canvas);
      expect(b.x).toBeCloseTo(a.x, 6);
      expect(b.y).toBeCloseTo(a.y, 6);
    }
  });

  it('lets the cursor reach both window edges instead of pinning at the scene edge', () => {
    const right = cameraToScreen(screenToCamera(1.3, 0.5, box), ext, canvas);
    expect(right.x).toBeGreaterThan(rect.left + rect.width);
    expect(right.inBox).toBe(true);
    const farRight = cameraToScreen([1 - ext.x1 - 0.01, 0.5], ext, canvas);
    expect(farRight.x).toBe(1440);
    expect(farRight.inBox).toBe(false);
    const left = cameraToScreen([1 - ext.x0 - 0.001, 0.5], ext, canvas);
    expect(left.x).toBeLessThan(5);
  });
});
