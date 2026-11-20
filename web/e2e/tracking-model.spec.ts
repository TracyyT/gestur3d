import { expect, test } from '@playwright/test';

/**
 * Runs only where the hand model was downloaded (CI, local machines with
 * internet). Uses Chromium's fake camera, so no hands are detected, but the
 * full detector must start and process frames.
 */
test.beforeEach(async ({ request }) => {
  const res = await request.get('/models/mediapipe/hand_landmarker.task');
  const isModel = res.ok() && !(res.headers()['content-type'] ?? '').includes('text/html');
  test.skip(!isModel, 'hand_landmarker.task not available (offline build)');
});

test('setup screen runs live detection on the main thread', async ({ page }) => {
  await page.goto('/setup');
  await page.getByRole('button', { name: /turn on camera/i }).click();
  // The preview readout appears once the detector is processing frames.
  await expect(page.getByText(/\d+ fps · [\d.]+ ms · (GPU|CPU)/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Tracking unavailable')).toHaveCount(0);
});

test('workspace starts hand tracking (worker or main thread) and reports it', async ({ page }) => {
  await page.goto('/setup');
  await page.getByRole('button', { name: /turn on camera/i }).click();
  await page.getByRole('link', { name: /continue without camera/i }).waitFor();
  await page.getByRole('button', { name: /enter anyway|enter workspace/i }).click();
  await expect(page).toHaveURL(/\/workspace$/);

  await page.getByRole('button', { name: 'Hand tracking' }).click();
  const status = page.getByText(/^● (Web Worker|Main thread)( · (GPU|CPU))?$/);
  await expect(status).toBeVisible({ timeout: 30_000 });
  test.info().annotations.push({
    type: 'tracking backend',
    description: (await status.textContent()) ?? '',
  });
  // Detection frames are flowing.
  await expect(
    page
      .getByText('Detection')
      .locator('..')
      .getByText(/^\d+fps$/),
  ).toBeVisible({ timeout: 15_000 });
});
