import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

/** The session log records actions and timings across inputs, and exports them. */

test('logs menu use, commands and hand drags, and exports CSV', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.__G3D_TEST_HOOKS__ = true;
  });
  await page.goto('/workspace');
  await expect
    .poll(() => page.evaluate(() => window.__G3D__?.objectUV('obj-2') ?? null), { timeout: 30_000 })
    .not.toBeNull();
  await page.waitForTimeout(500);
  const events = () => page.evaluate(() => window.__G3D__.session());

  // Keyboard menu: Add → first shape.
  await page.getByRole('application').focus();
  await page.keyboard.press('m');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  // A hand drag.
  const from = (await page.evaluate(() => window.__G3D__.objectUV('obj-2')))!;
  await page.evaluate(([from]) => window.__G3D__.playGrab({ from, to: { u: 0.3, v: 0.4 } }), [
    from,
  ] as const);

  const log = await events();
  const types = log.map((e) => e.type);
  expect(types[0]).toBe('mark');
  expect(log[0]).toMatchObject({ name: 'mode-enter', detail: 'workspace' });
  expect(log).toContainEqual(expect.objectContaining({ type: 'menuOpen', by: 'keyboard' }));
  expect(log).toContainEqual(
    expect.objectContaining({ type: 'menuClose', action: 'add', choice: 'sphere' }),
  );
  expect(log).toContainEqual(
    expect.objectContaining({ type: 'command', action: 'add', detail: 'sphere' }),
  );
  const drags = log.filter((e) => e.type === 'manipulate' && e.source === 'gesture');
  // One continuous drag is one event, not one per frame.
  expect(drags).toHaveLength(1);
  expect(drags[0]).toMatchObject({ op: 'move', target: 'obj-2' });
  expect(drags[0]!.steps as number).toBeGreaterThan(5);
  // Times only move forward.
  const ts = log.map((e) => e.t);
  expect([...ts].sort((a, b) => a - b)).toEqual(ts);

  // Export from Settings.
  await page.getByRole('button', { name: /Settings/ }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^gestur3d-session-.*\.csv$/);
  const csv = await readFile((await download.path())!, 'utf8');
  expect(csv.split('\n')[0]).toBe('t_ms,type,source,action,target,duration_ms,steps,detail');
  expect(csv).toContain('manipulate,gesture,move,obj-2');
});
