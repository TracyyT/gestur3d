import { expect, test } from '@playwright/test';

import './support/g3d';
import type { Vec3 } from './support/g3d';

/** Drawings are scene objects: they can be grabbed, moved and undone. */

const WAVE: Vec3[] = Array.from({ length: 24 }, (_, i) => {
  const t = i / 23;
  return [-0.8 + 1.6 * t, 1.6 + 0.25 * Math.sin(t * Math.PI * 4), 0.8];
});

test('a drawing can be grabbed by hand, moved, and undone', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.__G3D_TEST_HOOKS__ = true;
  });
  await page.goto('/workspace');
  await page.getByRole('button', { name: 'Hide panels' }).click();
  await expect
    .poll(() => page.evaluate(() => window.__G3D__?.objectUV('obj-2') ?? null), { timeout: 30_000 })
    .not.toBeNull();

  const before = await page.evaluate(() => window.__G3D__.objects().length);
  await page.evaluate((pts) => window.__G3D__.addStroke(pts), WAVE);
  const id = await page.evaluate(() => {
    const all = window.__G3D__.objects();
    return all[all.length - 1]!.id;
  });
  expect(await page.evaluate(() => window.__G3D__.objects().length)).toBe(before + 1);

  await expect.poll(() => page.evaluate((id) => window.__G3D__.objectUV(id), id)).not.toBeNull();
  await page.waitForTimeout(400);
  const from = (await page.evaluate((id) => window.__G3D__.objectUV(id), id))!;
  const to = { u: 0.3, v: 0.35 };
  await page.evaluate(([from, to]) => window.__G3D__.playGrab({ from, to }), [from, to] as const);

  const end = (await page.evaluate((id) => window.__G3D__.objectUV(id), id))!;
  expect(Math.abs(end.u - to.u)).toBeLessThan(0.015);
  expect(Math.abs(end.v - to.v)).toBeLessThan(0.015);
  expect(await page.evaluate(() => window.__G3D__.selectedId())).toBe(id);

  // Undo removes the drawing again.
  await page.getByRole('button', { name: 'Show panels' }).click();
  const undo = page.getByRole('button', { name: 'Undo' }).first();
  await undo.click();
  await expect.poll(() => page.evaluate(() => window.__G3D__.objects().length)).toBe(before);
});
