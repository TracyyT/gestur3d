import { expect, test, type Page } from '@playwright/test';

/** Practice mode: lessons, progress, and leaving the workspace untouched. */

async function open(page: Page, path = '/practice') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.__G3D_TEST_HOOKS__ = true;
  });
  await page.goto(path);
  await expect(page.getByRole('region', { name: 'Lesson' })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(500);
}

const lesson = (page: Page) => page.getByRole('region', { name: 'Lesson' });
const progress = (page: Page) => lesson(page).getByRole('progressbar', { name: 'Lesson progress' });

test('lesson 1 passes with one hand, then both, held in view', async ({ page }) => {
  test.setTimeout(90_000);
  await open(page);
  await expect(lesson(page).getByRole('heading', { name: 'Show your hands' })).toBeVisible();
  await expect(lesson(page).getByRole('img', { name: /Demo/ })).toBeVisible();

  const right = [
    { at: 0, u: 0.6, v: 0.5, pinch: 0 },
    { at: 5000, u: 0.6, v: 0.5, pinch: 0 },
  ];
  const left = [
    { at: 0, u: 0.4, v: 0.5, pinch: 0, visible: false },
    { at: 2400, u: 0.4, v: 0.5, pinch: 0, visible: false },
    { at: 2500, u: 0.4, v: 0.5, pinch: 0 },
    { at: 5000, u: 0.4, v: 0.5, pinch: 0 },
  ];
  const play = page.evaluate(([right, left]) => window.__G3D__.playTwoHand({ right, left }), [
    right,
    left,
  ] as const);
  // One hand alone passes the first step, then asks for the other.
  await expect(lesson(page).getByText('Now the other hand too')).toBeVisible({ timeout: 20_000 });
  expect(Number(await progress(page).getAttribute('aria-valuenow'))).toBeLessThan(100);
  await play;
  await expect(lesson(page).getByText('Nice, that’s it.')).toBeVisible();
  await expect(progress(page)).toHaveAttribute('aria-valuenow', '100');
  await expect(lesson(page).getByRole('button', { name: 'Next' })).toBeVisible();

  // Progress is saved.
  await page.reload();
  await expect(
    lesson(page).getByRole('button', { name: /Lesson 1: Show your hands, done/ }),
  ).toBeVisible({
    timeout: 30_000,
  });
});

test('a lesson can be skipped, and free practice follows the last lesson', async ({ page }) => {
  await open(page);
  await lesson(page).getByRole('button', { name: 'Skip' }).click();
  const free = page.getByRole('region', { name: 'Free practice' });
  await expect(free).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__G3D__.objects().length)).toBe(3);
  await free.getByRole('button', { name: 'Back to lessons' }).click();
  await expect(lesson(page).getByRole('heading', { name: 'Show your hands' })).toBeVisible();
  const marks = await page.evaluate(() =>
    window.__G3D__
      .session()
      .filter((e) => e.type === 'mark')
      .map((e) => `${e.name}:${e.detail ?? ''}`),
  );
  expect(marks).toEqual(
    expect.arrayContaining([
      'mode-enter:practice',
      'lesson-start:hands',
      'lesson-skip:hands',
      'free-practice:',
    ]),
  );
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
  await expect(nav.getByRole('link', { name: 'Practice' })).toHaveAttribute('aria-current', 'page');
  // Lesson 1's scene is empty.
  await expect.poll(() => page.evaluate(() => window.__G3D__.objects().length)).toBe(0);

  await nav.getByRole('link', { name: 'Workspace' }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  const debug = () =>
    page.evaluate(() =>
      JSON.stringify({
        kinds: window.__G3D__.objects().map((o) => o.kind),
        marks: window.__G3D__
          .session()
          .filter((e) => e.type === 'mark')
          .map((e) => `${e.t}:${e.name}:${e.detail ?? ''}`),
        mode: document.querySelector('[data-mode]')?.getAttribute('data-mode'),
      }),
    );
  await expect
    .poll(() => page.evaluate(() => window.__G3D__.objects().map((o) => o.kind)), {
      message: 'workspace scene restored',
    })
    .toEqual(['sphere', 'cube', 'sculpture', 'ring'])
    .catch(async (e: unknown) => {
      throw new Error(`${String(e)}\nDEBUG ${await debug()}`);
    });
});

test('the camera prompt in a lesson returns to Practice after setup', async ({ page }) => {
  await open(page);
  const link = lesson(page).getByRole('link', { name: 'Turn on camera' });
  await expect(link).toHaveAttribute('href', '/setup?next=/practice');
  await link.click();
  await page.getByRole('link', { name: 'Continue with mouse only' }).click();
  await expect(page).toHaveURL(/\/practice$/);
});
