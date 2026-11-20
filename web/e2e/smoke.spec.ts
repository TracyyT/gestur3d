import { expect, test } from '@playwright/test';

test('landing page links to camera setup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Shape light');
  await page.getByRole('link', { name: /launch workspace/i }).click();
  await expect(page).toHaveURL(/\/setup$/);
});

test('unknown routes show the not-found page', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page.getByText(/doesn’t exist yet/i)).toBeVisible();
});
