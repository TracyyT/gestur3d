import { expect, test, type Page } from '@playwright/test';

/**
 * Two-hand grabs through the real pipeline (tracker → mapping → raycast →
 * engine → scene), driven by scripted landmarks for both hands.
 */

import type { HandKey, Quat, UV } from './support/g3d';

interface Sample {
  t: number;
  x: number;
  y: number;
  scale: number;
  two: number;
  mode: string | null;
  chip: string | null;
  limit: string | null;
}

async function open(page: Page, width: number, height: number, panels: boolean) {
  const stall = Number(process.env.HAND_E2E_FRAME_STALL_MS ?? 0);
  if (stall > 0) {
    await page.addInitScript((ms: number) => {
      const raf = window.requestAnimationFrame.bind(window);
      let lastStall = -1;
      window.requestAnimationFrame = (cb) =>
        raf((t) => {
          if (t !== lastStall) {
            lastStall = t;
            const end = performance.now() + ms;
            while (performance.now() < end) {
              /* stall this frame */
            }
          }
          cb(t);
        });
    }, stall);
  }
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    window.__G3D_TEST_HOOKS__ = true;
  });
  await page.goto('/workspace');
  if (!panels) await page.getByRole('button', { name: 'Hide panels' }).click();
  await expect
    .poll(() => page.evaluate(() => window.__G3D__?.objectUV('obj-2') ?? null), { timeout: 30_000 })
    .not.toBeNull();
  await page.waitForTimeout(600);
}

const cube = (page: Page) =>
  page.evaluate(() => window.__G3D__.objects().find((o) => o.id === 'obj-2')!);

/** Play a two-hand script while sampling the cube every rendered frame. */
async function playSampled(page: Page, right: HandKey[], left: HandKey[]): Promise<Sample[]> {
  return page.evaluate(
    async ([right, left]) => {
      const g = window.__G3D__;
      const out: Sample[] = [];
      let on = true;
      const tick = () => {
        if (!on) return;
        const r = g.sceneRect();
        const uv = g.objectUV('obj-2')!;
        const o = g.objects().find((x) => x.id === 'obj-2')!;
        const th = g.twoHand();
        const chip = document.querySelector<HTMLElement>('[data-testid="two-hand-readout"]');
        const shown = chip && chip.style.opacity === '1';
        out.push({
          chip: shown ? chip.textContent : null,
          limit: shown ? (chip.dataset.limit ?? null) : null,
          // Script time of the last frame the engine processed, so windows
          // line up with the script even when rendering stalls.
          t: g.scriptTime() ?? -1,
          x: uv.u * r.width,
          y: uv.v * r.height,
          scale: o.scale,
          two: th.length,
          mode: th[0]?.mode ?? null,
        });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      await g.playTwoHand({ right, left });
      on = false;
      return out;
    },
    [right, left] as const,
  );
}

/** Largest on-screen move of the cube between samples whose script times fall in [from, to]. */
function maxDrift(samples: Sample[], from: number, to: number) {
  const s = samples.filter((x) => x.t >= from && x.t <= to);
  let m = 0;
  for (const a of s) for (const b of s) m = Math.max(m, Math.hypot(a.x - b.x, a.y - b.y));
  return m;
}

/** Angle in degrees between two unit quaternions. */
const angleDeg = (a: Quat, b: Quat) =>
  (2 *
    Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) *
    180) /
  Math.PI;

/** UV offset for a pixel offset in the visible scene rect. */
async function px(page: Page) {
  const r = await page.evaluate(() => window.__G3D__.sceneRect());
  return (dx: number, dy: number, c: UV): UV => ({ u: c.u + dx / r.width, v: c.v + dy / r.height });
}

const SIZES: Array<[string, number, number, boolean]> = [
  ['1440×900, panels open', 1440, 900, true],
  ['1440×900, panels hidden', 1440, 900, false],
  ['950×920, panels open', 950, 920, true],
];

test.describe('two-hand grab', () => {
  for (const [name, w, h, panels] of SIZES) {
    test(`joins without a jump, then scales about 2× (${name})`, async ({ page }) => {
      await open(page, w, h, panels);
      const c = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
      const at = await px(page);
      const R = at(40, 0, c);
      const L = at(-40, 0, c);
      const R2 = at(80, 0, c);
      const L2 = at(-80, 0, c);
      const before = await cube(page);
      // Right grabs (0.4–0.55 s); left joins at 1.0–1.15 s; both hold still to
      // 1.6 s; spread to 2.4 s; hold to 3.0 s; both let go.
      const right: HandKey[] = [
        { at: 0, ...R, pinch: 0 },
        { at: 400, ...R, pinch: 0 },
        { at: 550, ...R, pinch: 1 },
        { at: 1600, ...R, pinch: 1 },
        { at: 2400, ...R2, pinch: 1 },
        { at: 3000, ...R2, pinch: 1 },
        { at: 3150, ...R2, pinch: 0 },
        { at: 3500, ...R2, pinch: 0 },
      ];
      const left: HandKey[] = [
        { at: 0, ...L, pinch: 0 },
        { at: 1000, ...L, pinch: 0 },
        { at: 1150, ...L, pinch: 1 },
        { at: 1600, ...L, pinch: 1 },
        { at: 2400, ...L2, pinch: 1 },
        { at: 3000, ...L2, pinch: 1 },
        { at: 3150, ...L2, pinch: 0 },
        { at: 3500, ...L2, pinch: 0 },
      ];
      const samples = await playSampled(page, right, left);

      // The two-hand grab happened.
      const joined = samples.find((s) => s.two === 1);
      expect(joined, 'second hand joined').toBeTruthy();
      // Still hands around the join: the cube didn't move.
      expect(maxDrift(samples, 800, 1550)).toBeLessThanOrEqual(1);
      const after = await cube(page);
      // Spreading 2× scales about 2× (soft dead zone takes ~3%).
      expect(after.scale / before.scale).toBeGreaterThan(1.85);
      expect(after.scale / before.scale).toBeLessThan(2.05);
      // Midpoint didn't move, so the cube stayed centered under the hands.
      const end = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
      const r = await page.evaluate(() => window.__G3D__.sceneRect());
      expect(Math.abs(end.u - c.u) * r.width).toBeLessThan(6);
      expect(Math.abs(end.v - c.v) * r.height).toBeLessThan(6);
      // The readout showed scale and angle while both hands held it.
      expect(samples.some((s) => /^\d\.\d\d× · \d+°$/.test(s.chip ?? ''))).toBe(true);
      // Released: nothing held, readout hidden.
      expect(await page.evaluate(() => window.__G3D__.twoHand().length)).toBe(0);
      await expect(page.getByTestId('two-hand-readout')).toHaveCSS('opacity', '0');
      expect(await page.evaluate(() => window.__G3D__.pointers().some((p) => p.grabbedId))).toBe(
        false,
      );
    });
  }

  test('spreading far past the limit stops at 3× and flags the limit', async ({ page }) => {
    await open(page, 1440, 900, true);
    const c = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
    const at = await px(page);
    const right: HandKey[] = [
      { at: 0, ...at(40, 0, c), pinch: 0 },
      { at: 400, ...at(40, 0, c), pinch: 0 },
      { at: 550, ...at(40, 0, c), pinch: 1 },
      { at: 1300, ...at(40, 0, c), pinch: 1 },
      { at: 2300, ...at(240, 0, c), pinch: 1 },
      { at: 2800, ...at(240, 0, c), pinch: 1 },
      { at: 2950, ...at(240, 0, c), pinch: 0 },
      { at: 3300, ...at(240, 0, c), pinch: 0 },
    ];
    const left: HandKey[] = [
      { at: 0, ...at(-40, 0, c), pinch: 0 },
      { at: 900, ...at(-40, 0, c), pinch: 0 },
      { at: 1050, ...at(-40, 0, c), pinch: 1 },
      { at: 1300, ...at(-40, 0, c), pinch: 1 },
      { at: 2300, ...at(-240, 0, c), pinch: 1 },
      { at: 2800, ...at(-240, 0, c), pinch: 1 },
      { at: 2950, ...at(-240, 0, c), pinch: 0 },
      { at: 3300, ...at(-240, 0, c), pinch: 0 },
    ];
    const samples = await playSampled(page, right, left);
    const after = await cube(page);
    expect(after.scale).toBeGreaterThan(2.95);
    expect(after.scale).toBeLessThanOrEqual(3);
    expect(samples.some((s) => s.limit === 'true')).toBe(true);
  });

  test('turning the hands like a wheel rolls the cube about 90°', async ({ page }) => {
    await open(page, 1440, 900, true);
    const c = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
    const at = await px(page);
    const before = await cube(page);
    // Hands 100 px apart, horizontal, then turned 90° counter-clockwise on screen.
    const steps = 6;
    const right: HandKey[] = [
      { at: 0, ...at(50, 0, c), pinch: 0 },
      { at: 300, ...at(50, 0, c), pinch: 0 },
      { at: 450, ...at(50, 0, c), pinch: 1 },
    ];
    const left: HandKey[] = [
      { at: 0, ...at(-50, 0, c), pinch: 0 },
      { at: 700, ...at(-50, 0, c), pinch: 0 },
      { at: 850, ...at(-50, 0, c), pinch: 1 },
      { at: 1200, ...at(-50, 0, c), pinch: 1 },
    ];
    right.push({ at: 1200, ...at(50, 0, c), pinch: 1 });
    for (let i = 1; i <= steps; i++) {
      const a = (i / steps) * (Math.PI / 2);
      const t = 1200 + i * 150;
      // Screen y grows downward: counter-clockwise means up for the right hand.
      right.push({ at: t, ...at(50 * Math.cos(a), -50 * Math.sin(a), c), pinch: 1 });
      left.push({ at: t, ...at(-50 * Math.cos(a), 50 * Math.sin(a), c), pinch: 1 });
    }
    const end = 1200 + steps * 150;
    right.push(
      { at: end + 600, ...at(0, -50, c), pinch: 1 },
      { at: end + 750, ...at(0, -50, c), pinch: 0 },
      { at: end + 1000, ...at(0, -50, c), pinch: 0 },
    );
    left.push(
      { at: end + 600, ...at(0, 50, c), pinch: 1 },
      { at: end + 750, ...at(0, 50, c), pinch: 0 },
      { at: end + 1000, ...at(0, 50, c), pinch: 0 },
    );
    await playSampled(page, right, left);
    const after = await cube(page);
    const turned = angleDeg(before.rotation, after.rotation);
    // 90° less the 2° soft dead zone.
    expect(turned).toBeGreaterThan(84);
    expect(turned).toBeLessThan(93);
    expect(after.scale / before.scale).toBeGreaterThan(0.95);
    expect(after.scale / before.scale).toBeLessThan(1.05);
  });

  test('one hand letting go leaves the other holding it, without a jump', async ({ page }) => {
    await open(page, 1440, 900, true);
    const c = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
    const at = await px(page);
    const R = at(45, 0, c);
    const L = at(-45, 0, c);
    const Lfar = at(-110, 0, c);
    const R3 = at(45, 120, c);
    // Both grab. Only the left hand moves out (1.3–1.7 s), which scales the
    // cube and shifts it, so the right hand's original grab offset is stale.
    // Left lets go at 2.3 s; right holds still, then carries the cube down.
    const right: HandKey[] = [
      { at: 0, ...R, pinch: 0 },
      { at: 400, ...R, pinch: 0 },
      { at: 550, ...R, pinch: 1 },
      { at: 3000, ...R, pinch: 1 },
      { at: 3800, ...R3, pinch: 1 },
      { at: 4100, ...R3, pinch: 1 },
      { at: 4250, ...R3, pinch: 0 },
      { at: 4600, ...R3, pinch: 0 },
    ];
    const left: HandKey[] = [
      { at: 0, ...L, pinch: 0 },
      { at: 900, ...L, pinch: 0 },
      { at: 1050, ...L, pinch: 1 },
      { at: 1300, ...L, pinch: 1 },
      { at: 1700, ...Lfar, pinch: 1 },
      { at: 2300, ...Lfar, pinch: 1 },
      { at: 2450, ...Lfar, pinch: 0 },
      { at: 4600, ...Lfar, pinch: 0 },
    ];
    const samples = await playSampled(page, right, left);
    expect(samples.some((s) => s.two === 1)).toBe(true);
    // Hands still from 2.0 s to 2.95 s, across the release.
    expect(maxDrift(samples, 2000, 2950)).toBeLessThanOrEqual(1);
    // Then the right hand carried it 120 px down.
    const held = samples.filter((s) => s.t >= 2800 && s.t <= 2950).at(-1)!;
    const last = samples.at(-1)!;
    expect(Math.abs(last.x - held.x)).toBeLessThan(4);
    expect(Math.abs(last.y - held.y - 120)).toBeLessThan(4);
  });

  test('one hand dropping out briefly or for longer never jumps the cube', async ({ page }) => {
    await open(page, 1440, 900, true);
    const c = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
    const at = await px(page);
    const R = at(45, 0, c);
    const L = at(-45, 0, c);
    const Lfar = at(-110, 0, c);
    // After the join only the left hand moves out (stale right-hand offset),
    // then the left hand vanishes 200 ms (within grace) at 2.2 s and 600 ms
    // (beyond) at 3.0 s.
    const right: HandKey[] = [
      { at: 0, ...R, pinch: 0 },
      { at: 400, ...R, pinch: 0 },
      { at: 550, ...R, pinch: 1 },
      { at: 4300, ...R, pinch: 1 },
      { at: 4450, ...R, pinch: 0 },
      { at: 4700, ...R, pinch: 0 },
    ];
    const left: HandKey[] = [
      { at: 0, ...L, pinch: 0 },
      { at: 900, ...L, pinch: 0 },
      { at: 1050, ...L, pinch: 1 },
      { at: 1300, ...L, pinch: 1 },
      { at: 1700, ...Lfar, pinch: 1 },
      { at: 2200, ...Lfar, pinch: 1 },
      { at: 2201, ...Lfar, pinch: 1, visible: false },
      { at: 2400, ...Lfar, pinch: 1, visible: false },
      { at: 2401, ...Lfar, pinch: 1 },
      { at: 3000, ...Lfar, pinch: 1 },
      { at: 3001, ...Lfar, pinch: 1, visible: false },
      { at: 3600, ...Lfar, pinch: 1, visible: false },
      { at: 3601, ...Lfar, pinch: 1 },
      { at: 4300, ...Lfar, pinch: 1 },
      { at: 4450, ...Lfar, pinch: 0 },
      { at: 4700, ...Lfar, pinch: 0 },
    ];
    const samples = await playSampled(page, right, left);
    expect(
      samples.some((s) => s.mode === 'one'),
      'saw the one-hand-lost state',
    ).toBe(true);
    expect(maxDrift(samples, 2000, 4250)).toBeLessThanOrEqual(1);
  });
});
