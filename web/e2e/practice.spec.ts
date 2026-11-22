import { expect, test, type Page } from '@playwright/test';
import type { HandKey, UV } from './support/g3d';

/** Practice: a checklist of gestures that tick off when done by hand. */

async function open(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.__G3D_TEST_HOOKS__ = true;
  });
  await page.goto('/practice');
  await expect(panel(page)).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() => page.evaluate(() => window.__G3D__?.objectUV('obj-2') ?? null), { timeout: 30_000 })
    .not.toBeNull();
  await page.waitForTimeout(500);
}

const panel = (page: Page) => page.getByRole('region', { name: 'Practice' });
const task = (page: Page, name: string) =>
  panel(page)
    .getByRole('list', { name: 'Practice tasks' })
    .getByRole('listitem')
    .filter({ hasText: name });
const isDone = (page: Page, name: string) => expect(task(page, name)).toContainText(': done');

// Empty space below the default objects.
const SPOT: UV = { u: 0.42, v: 0.72 };

test('the landing page has its own way into Practice', async ({ page }) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: 'Practice gestures' });
  await expect(link).toHaveAttribute('href', '/setup?next=/practice');
  await link.click();
  await page.getByRole('link', { name: 'Continue with mouse only' }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole('link', { name: 'Turn on camera' })).toHaveAttribute(
    'href',
    '/setup?next=/practice',
  );
});

test('lists every task, with a demo of the next one', async ({ page }) => {
  await open(page);
  const items = panel(page).getByRole('list', { name: 'Practice tasks' }).getByRole('listitem');
  await expect(items).toHaveCount(7);
  await expect(items.first()).toContainText('Grab and move');
  await expect(task(page, 'Push and pull')).toContainText('optional');
  // The next task shows how, with a demo; the others don't.
  await expect(task(page, 'Grab and move')).toContainText('Pinch an object');
  await expect(
    task(page, 'Grab and move').getByRole('img', { name: 'Demo: Grab and move' }),
  ).toBeVisible();
  await expect(panel(page).getByRole('img', { name: /^Demo/ })).toHaveCount(1);
});

test('grabbing and moving by hand ticks the first task; the mouse does not', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  // A mouse drag doesn't count.
  const r = await page.evaluate(() => window.__G3D__.sceneRect());
  const a = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  await page.mouse.move(r.left + a.u * r.width, r.top + a.v * r.height);
  await page.mouse.down();
  await page.mouse.move(r.left + (a.u + 0.2) * r.width, r.top + a.v * r.height, { steps: 8 });
  await page.mouse.up();
  await expect(task(page, 'Grab and move')).not.toContainText(': done');

  const from = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  await page.evaluate(
    ([from]) => window.__G3D__.playGrab({ from, to: { u: from.u - 0.2, v: from.v } }),
    [from] as const,
  );
  await isDone(page, 'Grab and move');
  await expect(panel(page).getByRole('img', { name: 'Demo: Resize with two hands' })).toBeVisible();

  // Saved, and Start over clears it.
  await page.reload();
  await isDone(page, 'Grab and move');
  await panel(page).getByRole('button', { name: 'Start over' }).click();
  await expect(task(page, 'Grab and move')).not.toContainText(': done');
});

test('opening the menu by pointing and adding a shape tick their tasks', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  // The keyboard doesn't count.
  await page.getByRole('application').focus();
  await page.keyboard.press('m');
  await page.keyboard.press('Escape');
  await expect(task(page, 'Open the menu')).not.toContainText(': done');

  const rect = await page.evaluate(() => window.__G3D__.sceneRect());
  const up = (dy: number): UV => ({ u: SPOT.u, v: SPOT.v - dy / rect.height });
  const keys: HandKey[] = [
    { at: 0, ...SPOT, pinch: 0 },
    { at: 300, ...SPOT, pinch: 0 },
    { at: 500, ...SPOT, pinch: 0, point: true },
    { at: 1500, ...SPOT, pinch: 0, point: true },
    { at: 1800, ...up(100), pinch: 0 },
    { at: 2100, ...up(205), pinch: 0 },
    { at: 2400, ...up(205), pinch: 0 },
    { at: 2550, ...up(205), pinch: 1 },
    { at: 2750, ...up(205), pinch: 1 },
    { at: 2900, ...up(205), pinch: 0 },
    { at: 3200, ...up(205), pinch: 0 },
  ];
  await page.evaluate((k) => window.__G3D__.playHand(k), keys);
  await isDone(page, 'Open the menu');
  await isDone(page, 'Add a shape from the menu');
});

test('drawing by hand ticks Draw in the air', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  await page.getByRole('button', { name: 'Draw' }).click();
  await page.evaluate(
    (k) => window.__G3D__.playHand(k),
    [
      { at: 0, u: 0.3, v: 0.75, pinch: 0 },
      { at: 300, u: 0.3, v: 0.75, pinch: 0 },
      { at: 450, u: 0.3, v: 0.75, pinch: 1 },
      { at: 900, u: 0.42, v: 0.68, pinch: 1 },
      { at: 1350, u: 0.55, v: 0.78, pinch: 1 },
      { at: 1500, u: 0.55, v: 0.78, pinch: 0 },
      { at: 1800, u: 0.55, v: 0.78, pinch: 0 },
    ],
  );
  await isDone(page, 'Draw in the air');
});

test('Practice leaves the workspace scene as it was', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.__G3D_TEST_HOOKS__ = true;
  });
  await page.goto('/workspace');
  await expect
    .poll(() => page.evaluate(() => window.__G3D__?.objects().length ?? 0), { timeout: 30_000 })
    .toBe(3);
  await page.getByRole('button', { name: 'Ring' }).click();
  await expect.poll(() => page.evaluate(() => window.__G3D__.objects().length)).toBe(4);

  const nav = page.getByRole('navigation', { name: 'Modes' });
  await nav.getByRole('link', { name: 'Practice' }).click();
  await expect(page).toHaveURL(/\/practice$/);
  await expect(panel(page)).toBeVisible();
  // Practice has its own fresh objects.
  await expect.poll(() => page.evaluate(() => window.__G3D__.objects().length)).toBe(3);

  await nav.getByRole('link', { name: 'Workspace' }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect
    .poll(() => page.evaluate(() => window.__G3D__.objects().map((o) => o.kind)), {
      timeout: 15_000,
    })
    .toEqual(['sphere', 'cube', 'sculpture', 'ring']);
});
