import { expect, test, type Page } from '@playwright/test';
import type { HandKey } from './support/g3d';

/** The Draw tool, driven by scripted hands through the real pipeline. */

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

const count = (page: Page) => page.evaluate(() => window.__G3D__.objects().length);

// A pinch dragged left to right through empty space below the default objects.
const SWEEP: HandKey[] = [
  { at: 0, u: 0.3, v: 0.75, pinch: 0 },
  { at: 300, u: 0.3, v: 0.75, pinch: 0 },
  { at: 450, u: 0.3, v: 0.75, pinch: 1 },
  { at: 900, u: 0.42, v: 0.68, pinch: 1 },
  { at: 1350, u: 0.55, v: 0.78, pinch: 1 },
  { at: 1500, u: 0.55, v: 0.78, pinch: 0 },
  { at: 1800, u: 0.55, v: 0.78, pinch: 0 },
];

test('with Draw on, pinching empty space draws a stroke that becomes an object', async ({
  page,
}) => {
  await open(page);
  const before = await count(page);
  await page.getByRole('button', { name: 'Draw' }).click();
  await expect(page.getByRole('button', { name: 'Draw' })).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate((k) => window.__G3D__.playHand(k), SWEEP);
  await expect.poll(() => count(page)).toBe(before + 1);
  // The drawing is grabbable where it was drawn.
  const id = await page.evaluate(() => window.__G3D__.objects().at(-1)!.id);
  const uv = (await page.evaluate((id) => window.__G3D__.objectUV(id), id))!;
  expect(uv.v).toBeGreaterThan(0.6);
});

test('with Draw off, the same pinch draws nothing', async ({ page }) => {
  await open(page);
  const before = await count(page);
  await page.evaluate((k) => window.__G3D__.playHand(k), SWEEP);
  await page.waitForTimeout(300);
  expect(await count(page)).toBe(before);
});

test('with Draw on, pinching an object still grabs it instead of drawing', async ({ page }) => {
  await open(page);
  const before = await count(page);
  await page.getByRole('button', { name: 'Draw' }).click();
  const from = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  const to = { u: 0.3, v: 0.35 };
  await page.evaluate(([from, to]) => window.__G3D__.playGrab({ from, to }), [from, to] as const);
  const end = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  expect(Math.abs(end.u - to.u)).toBeLessThan(0.01);
  expect(await count(page)).toBe(before);
});
