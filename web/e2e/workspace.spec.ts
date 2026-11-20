import { expect, test } from '@playwright/test';

test.describe('workspace keyboard controls', () => {
  test('Tab cycles objects, Esc deselects, and focus can leave the scene', async ({ page }) => {
    await page.goto('/workspace');
    const scene = page.getByRole('application');
    const announcer = page.locator('[aria-live="polite"]').first();

    await scene.focus();
    await page.keyboard.press('Tab');
    await expect(announcer).toContainText('Sphere selected');
    await page.keyboard.press('Tab');
    await expect(announcer).toContainText('Cube selected');
    await page.keyboard.press('Shift+Tab');
    await expect(announcer).toContainText('Sphere selected');

    await page.keyboard.press('Escape');
    await expect(announcer).toContainText('No object selected');

    // Past the last object, Tab moves focus out of the scene (no keyboard trap).
    await page.keyboard.press('Tab'); // sphere
    await page.keyboard.press('Tab'); // cube
    await page.keyboard.press('Tab'); // sculpture
    await expect(announcer).toContainText('Sculpture selected');
    await page.keyboard.press('Tab');
    await expect(scene).not.toBeFocused();
  });

  test('? opens the controls dialog and Esc closes it', async ({ page }) => {
    await page.goto('/workspace');
    await page.getByRole('application').focus();
    await page.keyboard.press('?');
    const dialog = page.getByRole('dialog', { name: 'Controls' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('Delete removes the selected object', async ({ page }) => {
    await page.goto('/workspace');
    const announcer = page.locator('[aria-live="polite"]').first();
    await page.getByRole('application').focus();
    await page.keyboard.press('Tab');
    await expect(announcer).toContainText('Sphere selected');
    await page.keyboard.press('Delete');
    await expect(announcer).toContainText('No object selected');
    await page.keyboard.press('Tab');
    await expect(announcer).toContainText('Cube selected');
  });
});
