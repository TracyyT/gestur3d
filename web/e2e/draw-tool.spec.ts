import { expect, test, type Page } from '@playwright/test';
import type { HandKey } from './support/g3d';

/** The Draw tool, driven by scripted hands through the real pipeline. */

// CI renders on a slow software GPU; mouse events wait on frames there.
test.describe.configure({ timeout: 90_000 });

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

test('the radial menu turns Draw on, clears drawings, and Undo brings them back', async ({
  page,
}) => {
  await open(page);
  const scene = page.getByRole('application');
  const menu = page.getByRole('menu', { name: 'Radial menu' });
  const drawButton = page.getByRole('button', { name: 'Draw' });
  const strokes = () =>
    page.evaluate(() => window.__G3D__.objects().filter((o) => o.kind === 'stroke').length);

  await scene.focus();
  await page.keyboard.press('m');
  await expect(menu.getByRole('menuitem', { name: 'Clear' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight'); // Draw
  await page.keyboard.press('Enter');
  await expect(drawButton).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('m');
  await expect(menu.getByRole('menuitem', { name: 'Draw off' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.evaluate(() => {
    const line = (y: number) =>
      Array.from({ length: 8 }, (_, i) => [-1 + i * 0.3, y, 0.8] as [number, number, number]);
    window.__G3D__.addStroke(line(1.2));
    window.__G3D__.addStroke(line(0.6));
  });
  expect(await strokes()).toBe(2);

  await page.keyboard.press('m');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight'); // Clear
  await page.keyboard.press('Enter');
  await expect.poll(strokes).toBe(0);

  await page.keyboard.press('m');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight'); // Undo
  await page.keyboard.press('Enter');
  await expect.poll(strokes).toBe(2);
});

test.describe('mouse drawing', () => {
  /** Drag the mouse along a wavy path between two scene-relative points. */
  async function drag(page: Page, from: { u: number; v: number }, to: { u: number; v: number }) {
    const r = await page.evaluate(() => window.__G3D__.sceneRect());
    const at = (u: number, v: number) => [r.left + u * r.width, r.top + v * r.height] as const;
    await page.mouse.move(...at(from.u, from.v));
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      const t = i / 10;
      await page.mouse.move(
        ...at(from.u + (to.u - from.u) * t, from.v + (to.v - from.v) * t + 0.03 * Math.sin(t * 6)),
      );
    }
    await page.mouse.up();
  }

  test('with Draw on, dragging empty space draws instead of orbiting', async ({ page }) => {
    await open(page);
    const before = await count(page);
    const sphere = (await page.evaluate(() => window.__G3D__.objectUV('obj-1')))!;
    await page.getByRole('button', { name: 'Draw' }).click();
    await drag(page, { u: 0.3, v: 0.75 }, { u: 0.55, v: 0.75 });
    await expect.poll(() => count(page)).toBe(before + 1);
    // The view didn't orbit.
    const after = (await page.evaluate(() => window.__G3D__.objectUV('obj-1')))!;
    expect(Math.abs(after.u - sphere.u)).toBeLessThan(0.005);
  });

  test('with Draw on, dragging an object still moves it', async ({ page }) => {
    await open(page);
    const before = await count(page);
    await page.getByRole('button', { name: 'Draw' }).click();
    const from = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
    await drag(page, from, { u: from.u + 0.15, v: from.v });
    const end = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
    expect(end.u - from.u).toBeGreaterThan(0.08);
    expect(await count(page)).toBe(before);
  });

  test('with Draw off, dragging empty space orbits and draws nothing', async ({ page }) => {
    await open(page);
    const before = await count(page);
    const sphere = (await page.evaluate(() => window.__G3D__.objectUV('obj-1')))!;
    await drag(page, { u: 0.3, v: 0.75 }, { u: 0.55, v: 0.75 });
    await page.waitForTimeout(300);
    expect(await count(page)).toBe(before);
    const after = (await page.evaluate(() => window.__G3D__.objectUV('obj-1')))!;
    expect(Math.abs(after.u - sphere.u)).toBeGreaterThan(0.01);
  });
});

test('the hand reaches past the scene edge to the window edge, and draws there', async ({
  page,
}) => {
  await open(page);
  const before = await count(page);
  const rect = await page.evaluate(() => window.__G3D__.sceneRect());
  const width = await page.evaluate(() => window.innerWidth);
  expect(rect.left + rect.width).toBeLessThan(width - 100); // side panels take the right edge
  await page.getByRole('button', { name: 'Draw' }).click();
  // Sweep from inside the scene to 22% of its width past its right edge (still inside the window).
  const play = page.evaluate(
    (k) => window.__G3D__.playHand(k),
    [
      { at: 0, u: 0.7, v: 0.75, pinch: 0 },
      { at: 300, u: 0.7, v: 0.75, pinch: 0 },
      { at: 450, u: 0.7, v: 0.75, pinch: 1 },
      { at: 1300, u: 1.22, v: 0.75, pinch: 1 },
      { at: 1700, u: 1.22, v: 0.75, pinch: 1 },
      { at: 1850, u: 1.22, v: 0.75, pinch: 0 },
      { at: 2100, u: 1.22, v: 0.75, pinch: 0 },
    ],
  );
  await expect
    .poll(() => page.evaluate(() => window.__G3D__.pointers()[0]?.screen.x ?? 0))
    .toBeGreaterThan(rect.left + rect.width * 1.15);
  const cursor = await page.evaluate(() => window.__G3D__.pointers()[0]!);
  expect(cursor.inBox).toBe(true);
  await play;
  await expect.poll(() => count(page)).toBe(before + 1);
  // Pinned at the old edge, the drawing's center would be at most u 0.85.
  const id = await page.evaluate(() => window.__G3D__.objects().at(-1)!.id);
  const uv = (await page.evaluate((id) => window.__G3D__.objectUV(id), id))!;
  expect(uv.u).toBeGreaterThan(0.9);
});
