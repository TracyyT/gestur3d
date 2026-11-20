import { expect, test } from '@playwright/test';

test('camera setup explains permission, starts the camera and can stop it', async ({ page }) => {
  await page.goto('/setup');
  await expect(page.getByRole('heading', { name: /before we turn on your camera/i })).toBeVisible();

  await page.getByRole('button', { name: /turn on camera/i }).click();

  const preview = page.getByLabel(/live camera preview/i);
  await expect(preview).toBeVisible();
  await expect
    .poll(() => preview.evaluate((v: HTMLVideoElement) => v.readyState >= 2 && !!v.srcObject))
    .toBe(true);
  await expect(page.getByRole('list', { name: /calibration checks/i })).toBeVisible();

  await page.getByRole('button', { name: /stop camera/i }).click();
  await expect(page.getByRole('button', { name: /turn on camera/i })).toBeVisible();
});

test('leaving setup turns the camera off', async ({ page }) => {
  // Keep a handle on every stream the app opens, so we can check it after
  // the preview element is gone.
  await page.addInitScript(() => {
    const opened: MediaStream[] = [];
    (window as unknown as { __streams: MediaStream[] }).__streams = opened;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await original(c);
      opened.push(s);
      return s;
    };
  });
  const liveTracks = () =>
    page.evaluate(
      () =>
        (window as unknown as { __streams: MediaStream[] }).__streams
          .flatMap((s) => s.getTracks())
          .filter((t) => t.readyState === 'live').length,
    );

  await page.goto('/setup');
  await page.getByRole('button', { name: /turn on camera/i }).click();
  await expect(page.getByLabel(/live camera preview/i)).toBeVisible();
  expect(await liveTracks()).toBeGreaterThan(0);

  await page.getByRole('link', { name: 'Gestur3D' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(liveTracks).toBe(0);
});
