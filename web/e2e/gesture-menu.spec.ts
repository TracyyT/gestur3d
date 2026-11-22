import { expect, test, type Page } from '@playwright/test';
import type { HandKey, UV } from './support/g3d';

/** Opening and using the radial menu by pointing, through the real pipeline. */

async function open(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.__G3D_TEST_HOOKS__ = true;
  });
  await page.goto('/workspace');
  await expect
    .poll(() => page.evaluate(() => window.__G3D__?.objectUV('obj-2') ?? null), { timeout: 30_000 })
    .not.toBeNull();
  await page.waitForTimeout(600);
}

/** A UV `dy` px above `p` in the visible scene rect. */
async function above(page: Page, p: UV, dy: number): Promise<UV> {
  const r = await page.evaluate(() => window.__G3D__.sceneRect());
  return { u: p.u, v: p.v - dy / r.height };
}

const objects = (page: Page) => page.evaluate(() => window.__G3D__.objects().length);
const menu = (page: Page) => page.getByRole('menu', { name: 'Radial menu' });

// Empty space below the default objects, so the hand isn't hovering anything.
const SPOT: UV = { u: 0.42, v: 0.72 };

test('pointing (index up) held still opens the menu; pointing up and out, then pinching, adds an object', async ({
  page,
}) => {
  await open(page);
  const add = await above(page, SPOT, 75); // the Add sector
  const sphere = await above(page, SPOT, 150); // first outer item: Sphere
  const keys: HandKey[] = [
    { at: 0, ...SPOT, pinch: 0 },
    { at: 300, ...SPOT, pinch: 0 },
    { at: 500, ...SPOT, pinch: 0, point: true },
    { at: 1500, ...SPOT, pinch: 0, point: true },
    { at: 1800, ...add, pinch: 0 },
    { at: 2100, ...sphere, pinch: 0 },
    { at: 2400, ...sphere, pinch: 0 },
    { at: 2550, ...sphere, pinch: 1 },
    { at: 2750, ...sphere, pinch: 1 },
    { at: 2900, ...sphere, pinch: 0 },
    { at: 3200, ...sphere, pinch: 0 },
  ];
  const before = await objects(page);
  const play = page.evaluate((k) => window.__G3D__.playHand(k), keys);
  await expect(menu(page)).toBeVisible({ timeout: 5000 });
  await play;
  await expect(menu(page)).toBeHidden();
  expect(await objects(page)).toBe(before + 1);
  // The pinch that chose didn't also grab anything.
  expect(await page.evaluate(() => window.__G3D__.pointers().some((p) => p.grabbedId))).toBe(false);
});

test('an open hand held still never opens the menu', async ({ page }) => {
  await open(page);
  let opened = false;
  const watch = setInterval(async () => {
    if (
      await menu(page)
        .isVisible()
        .catch(() => false)
    )
      opened = true;
  }, 100);
  await page.evaluate(
    (k) => window.__G3D__.playHand(k),
    [
      { at: 0, ...SPOT, pinch: 0 },
      { at: 2500, ...SPOT, pinch: 0 },
    ],
  );
  clearInterval(watch);
  expect(opened).toBe(false);
});

test('the menu closes when the hand that opened it leaves', async ({ page }) => {
  await open(page);
  const keys: HandKey[] = [
    { at: 0, ...SPOT, pinch: 0, point: true },
    { at: 1300, ...SPOT, pinch: 0, point: true },
    { at: 1301, ...SPOT, pinch: 0, point: true, visible: false },
    { at: 2200, ...SPOT, pinch: 0, point: true, visible: false },
  ];
  const play = page.evaluate((k) => window.__G3D__.playHand(k), keys);
  await expect(menu(page)).toBeVisible({ timeout: 5000 });
  await play;
  await expect(menu(page)).toBeHidden();
});

test('with the setting off, pointing does nothing', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'gestur3d.settings',
      JSON.stringify({ state: { palmMenu: false }, version: 2 }),
    );
  });
  await open(page);
  await page.evaluate(
    (k) => window.__G3D__.playHand(k),
    [
      { at: 0, ...SPOT, pinch: 0, point: true },
      { at: 1800, ...SPOT, pinch: 0, point: true },
    ],
  );
  await expect(menu(page)).toBeHidden();
});
