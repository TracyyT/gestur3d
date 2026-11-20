import { expect, test, type Page } from '@playwright/test';

/**
 * Hand interactions, driven through the real pipeline (tracker → mapping →
 * raycast with the render camera → engine → scene) by replaying scripted
 * landmarks via the test hooks. No camera or model needed.
 */

type UV = { u: number; v: number };
type Vec3 = [number, number, number];
interface G3D {
  objects(): Array<{ id: string; position: Vec3 }>;
  selectedId(): string | null;
  pointers(): Array<{ phase: string; grabbedId: string | null }>;
  objectUV(id: string): UV | null;
  playGrab(s: {
    from: UV;
    to: UV;
    handedness?: 'Left' | 'Right';
    dropoutMs?: number;
    grip?: number;
    loosenTo?: number;
  }): Promise<void>;
  playSweep(from: UV, to: UV, handedness?: 'Left' | 'Right'): Promise<void>;
  playHold(uv: UV, ms: number, jitter?: number): Promise<void>;
}
declare global {
  interface Window {
    __G3D__: G3D;
    __G3D_TEST_HOOKS__?: boolean;
  }
}

async function open(page: Page, width: number, height: number, panels: boolean) {
  // HAND_E2E_CPU_THROTTLE=4 simulates a slow machine (few rendered frames per
  // detection) to check interactions don't depend on the render rate.
  const throttle = Number(process.env.HAND_E2E_CPU_THROTTLE ?? 0);
  if (throttle > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  // HAND_E2E_FRAME_STALL_MS=250 stalls every rendered frame, like CI's software
  // GPU, so several detections pile up between renders.
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
  // Wait until the scene has rendered and can project objects.
  await expect
    .poll(() => page.evaluate(() => window.__G3D__?.objectUV('obj-2') ?? null), { timeout: 30_000 })
    .not.toBeNull();
  await page.waitForTimeout(600); // let panel framing settle
}

const positions = (page: Page) => page.evaluate(() => window.__G3D__.objects());

const MATRIX: Array<[string, number, number, boolean, 'Left' | 'Right']> = [
  ['1440×900, panels open, right hand', 1440, 900, true, 'Right'],
  ['1440×900, panels hidden, left hand', 1440, 900, false, 'Left'],
  ['950×920, panels open, left hand', 950, 920, true, 'Left'],
  ['700×900, panels overlay, right hand', 700, 900, true, 'Right'],
];

test.describe('hand grab, move and release', () => {
  for (const [name, w, h, panels, hand] of MATRIX) {
    test(name, async ({ page }) => {
      await open(page, w, h, panels);
      const before = await positions(page);
      const from = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
      const to = { u: 0.25, v: 0.3 };
      await page.evaluate(
        ([from, to, hand]) => window.__G3D__.playGrab({ from, to, handedness: hand }),
        [from, to, hand] as const,
      );

      const end = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
      expect(Math.abs(end.u - to.u)).toBeLessThan(0.01);
      expect(Math.abs(end.v - to.v)).toBeLessThan(0.01);
      expect(await page.evaluate(() => window.__G3D__.selectedId())).toBe('obj-2');
      // Nothing else moved, and nothing is still held.
      const after = await positions(page);
      for (const o of before.filter((x) => x.id !== 'obj-2')) {
        expect(after.find((a) => a.id === o.id)!.position).toEqual(o.position);
      }
      expect(await page.evaluate(() => window.__G3D__.pointers().some((p) => p.grabbedId))).toBe(
        false,
      );
    });
  }
});

test('a short dropout (within the 300 ms grace) freezes the object, then the grab continues', async ({
  page,
}) => {
  await open(page, 1440, 900, true);
  const from = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  const to = { u: 0.25, v: 0.3 };
  // Sample hand phase and cube position on every rendered frame, in the page.
  const samples = await page.evaluate(
    async ([from, to]) => {
      const out: Array<{
        phase: string | undefined;
        held: string | null | undefined;
        pos: number[];
      }> = [];
      let raf = 0;
      const tick = () => {
        const p = window.__G3D__.pointers()[0];
        const pos = window.__G3D__.objects().find((o) => o.id === 'obj-2')!.position;
        out.push({ phase: p?.phase, held: p?.grabbedId, pos: [...pos] });
        raf = requestAnimationFrame(tick);
      };
      tick();
      await window.__G3D__.playGrab({ from, to, dropoutMs: 200 });
      cancelAnimationFrame(raf);
      return out;
    },
    [from, to] as const,
  );

  // At low render rates the whole dropout can fall between two rendered frames
  // (nothing to see, nothing moves). The freeze rule itself is unit-tested in
  // handInteraction.test.ts; here, any frame rendered while lost must show the
  // object still and held.
  const lost = samples.filter((s) => s.phase === 'lost');
  for (const s of lost) {
    expect(s.pos).toEqual(lost[0]!.pos);
    expect(s.held).toBe('obj-2');
  }
  // After re-acquiring, the grab continued to the target.
  const end = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  expect(Math.abs(end.u - to.u)).toBeLessThan(0.01);
  expect(Math.abs(end.v - to.v)).toBeLessThan(0.01);
});

test('a long dropout releases the object in place; it does not jump to the returning hand', async ({
  page,
}) => {
  await open(page, 1440, 900, true);
  const from = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  const to = { u: 0.2, v: 0.25 };
  const samples = await page.evaluate(
    async ([from, to]) => {
      const out: Array<{ phase: string | undefined; pos: number[] }> = [];
      let raf = 0;
      const tick = () => {
        const pos = window.__G3D__.objects().find((o) => o.id === 'obj-2')!.position;
        out.push({ phase: window.__G3D__.pointers()[0]?.phase, pos: [...pos] });
        raf = requestAnimationFrame(tick);
      };
      tick();
      await window.__G3D__.playGrab({ from, to, dropoutMs: 600 });
      cancelAnimationFrame(raf);
      return out;
    },
    [from, to] as const,
  );

  // The script drops the hand halfway through the move. Released in place
  // means the object stays at that halfway point instead of reaching `to`,
  // and the hand coming back pinched doesn't pick it up again.
  const end = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  const mid = { u: (from.u + to.u) / 2, v: (from.v + to.v) / 2 };
  expect(Math.hypot(end.u - mid.u, end.v - mid.v)).toBeLessThan(0.03);
  expect(Math.hypot(end.u - to.u, end.v - to.v)).toBeGreaterThan(0.05);
  expect(await page.evaluate(() => window.__G3D__.pointers().some((p) => p.grabbedId))).toBe(false);
  // Any frame rendered after tracking was lost shows the object still.
  const firstLost = samples.findIndex((s) => s.phase === 'lost');
  if (firstLost >= 0) {
    for (const s of samples.slice(firstLost))
      expect(s.pos, JSON.stringify(samples)).toEqual(samples[firstLost]!.pos);
  }
});

test('a light real-hand pinch grabs, and a grip that loosens mid-move keeps carrying', async ({
  page,
}) => {
  await open(page, 1440, 900, true);
  const from = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  const to = { u: 0.25, v: 0.3 };
  // grip 0.72 ≈ ratio 0.38 (fingertips touching on a real hand), loosening to
  // 0.5 ≈ ratio 0.64 halfway. The old thresholds never grabbed this and would
  // have frozen the object as soon as the grip loosened.
  await page.evaluate(
    ([from, to]) => window.__G3D__.playGrab({ from, to, grip: 0.72, loosenTo: 0.5 }),
    [from, to] as const,
  );
  const end = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  expect(Math.abs(end.u - to.u)).toBeLessThan(0.01);
  expect(Math.abs(end.v - to.v)).toBeLessThan(0.01);
  expect(await page.evaluate(() => window.__G3D__.pointers().some((p) => p.grabbedId))).toBe(false);
});

test('a closed pinch swept across an object does not grab it', async ({ page }) => {
  await open(page, 1440, 900, true);
  const before = await positions(page);
  const cube = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  await page.evaluate((cube) => window.__G3D__.playSweep({ u: 0.5, v: 0.9 }, cube), cube);
  expect(await positions(page)).toEqual(before);
  expect(await page.evaluate(() => window.__G3D__.selectedId())).toBeNull();
});

test('an idle, jittery open hand over an object never grabs it', async ({ page }) => {
  await open(page, 1440, 900, true);
  const before = await positions(page);
  const cube = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  // ~4 px of landmark noise for 3 s, hovering the cube.
  await page.evaluate((cube) => window.__G3D__.playHold(cube, 3000, 0.004), cube);
  expect(await positions(page)).toEqual(before);
  expect(await page.evaluate(() => window.__G3D__.selectedId())).toBeNull();
});

test('mouse still works, and keyboard selection is unaffected by hands', async ({ page }) => {
  await open(page, 1440, 900, true);
  const cube = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  await page.evaluate((cube) => window.__G3D__.playHold(cube, 300), cube);
  const rect = await page.evaluate(() =>
    (window.__G3D__ as unknown as { sceneRect(): { width: number; height: number } }).sceneRect(),
  );
  await page.mouse.click(cube.u * rect.width, cube.v * rect.height);
  await expect(page.locator('[aria-live="polite"]').first()).toContainText('Cube selected');
});
