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

test.describe('workspace panels', () => {
  test('adding an object from the Objects panel selects it', async ({ page }) => {
    await page.goto('/workspace');
    const announcer = page.locator('[aria-live="polite"]').first();
    await page.getByRole('button', { name: 'Add sphere' }).click();
    await expect(announcer).toContainText('Sphere 2 selected');
    await expect(
      page.getByRole('list', { name: 'Objects in the scene' }).getByRole('listitem'),
    ).toHaveCount(4);
  });

  test('all six new object types can be added and render without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/workspace');
    const announcer = page.locator('[aria-live="polite"]').first();
    for (const kind of ['Ring', 'Pyramid', 'Crystal', 'Capsule', 'Helix', 'Gyroscope']) {
      await page.getByRole('button', { name: `Add ${kind.toLowerCase()}` }).click();
      await expect(announcer).toContainText(`${kind} selected`);
    }
    await expect(
      page.getByRole('list', { name: 'Objects in the scene' }).getByRole('listitem'),
    ).toHaveCount(9);
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });

  test('the selected object can be recolored, and clicking again restores its colors', async ({
    page,
  }) => {
    await page.goto('/workspace');
    const color = page.getByRole('group', { name: 'Color' });
    await expect(color).toHaveCount(0);
    await page.getByRole('button', { name: 'Add ring' }).click();
    await color.getByRole('button', { name: 'White' }).click();
    await expect(color.getByRole('button', { name: 'White' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await color.getByRole('button', { name: 'White' }).click();
    await expect(color.getByRole('button', { name: 'White' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('Undo takes back adds, removes and recolors, from the panel and the keyboard', async ({
    page,
  }) => {
    await page.goto('/workspace');
    const list = page.getByRole('list', { name: 'Objects in the scene' }).getByRole('listitem');
    const undo = page.getByRole('button', { name: 'Undo', exact: true });
    await expect(undo).toBeDisabled();

    await page.getByRole('button', { name: 'Add gyroscope' }).click();
    await expect(list).toHaveCount(4);
    await page
      .getByRole('group', { name: 'Color' })
      .getByRole('button', { name: 'Violet' })
      .click();
    await page.getByRole('button', { name: 'Remove selected' }).click();
    await expect(list).toHaveCount(3);

    await undo.click(); // restore the gyroscope
    await expect(list).toHaveCount(4);
    await expect(
      page.getByRole('group', { name: 'Color' }).getByRole('button', { name: 'Violet' }),
    ).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('application').focus();
    await page.keyboard.press('ControlOrMeta+z'); // undo the color
    await expect(
      page.getByRole('group', { name: 'Color' }).getByRole('button', { name: 'Violet' }),
    ).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('ControlOrMeta+z'); // undo the add
    await expect(list).toHaveCount(3);
    await expect(undo).toBeDisabled();
  });

  test('panels can be hidden and shown', async ({ page }) => {
    await page.goto('/workspace');
    const panels = page.getByRole('complementary', { name: 'Workspace panels' });
    await expect(panels).toBeVisible();
    await page.getByRole('button', { name: 'Hide panels' }).click();
    await expect(panels).toBeHidden();
    await page.getByRole('button', { name: 'Show panels' }).click();
    await expect(panels).toBeVisible();
  });

  test('settings persist across reloads', async ({ page }) => {
    await page.goto('/workspace');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByLabel('Visual quality').selectOption('low');
    await page.reload();
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByLabel('Visual quality')).toHaveValue('low');
  });
});

test.describe('radial menu', () => {
  test('M opens it; arrows and Enter add an object from the outer ring; Esc closes', async ({
    page,
  }) => {
    await page.goto('/workspace');
    const scene = page.getByRole('application');
    const menu = page.getByRole('menu', { name: 'Radial menu' });
    const list = page.getByRole('list', { name: 'Objects in the scene' }).getByRole('listitem');
    await scene.focus();
    await page.keyboard.press('m');
    await expect(menu).toBeVisible();
    await page.keyboard.press('ArrowRight'); // Add (first sector)
    await page.keyboard.press('Enter'); // into the outer ring: Sphere
    await page.keyboard.press('ArrowRight'); // Cube
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    await expect(list).toHaveCount(4);
    await expect(page.locator('[aria-live="polite"]').first()).toContainText('Cube 2 selected');

    await page.keyboard.press('m');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape'); // back to the inner ring
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('disabled actions do nothing; Delete and Undo work from the menu', async ({ page }) => {
    await page.goto('/workspace');
    const scene = page.getByRole('application');
    const menu = page.getByRole('menu', { name: 'Radial menu' });
    const list = page.getByRole('list', { name: 'Objects in the scene' }).getByRole('listitem');
    await scene.focus();
    await page.keyboard.press('m');
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await page.keyboard.press('Escape');

    await page.keyboard.press('Tab'); // select the sphere
    await page.keyboard.press('m');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight'); // Delete
    await page.keyboard.press('Enter');
    await expect(list).toHaveCount(2);
    await page.keyboard.press('m');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight'); // Undo
    await page.keyboard.press('Enter');
    await expect(list).toHaveCount(3);
  });

  test('the mouse can point at and click menu items', async ({ page }) => {
    await page.goto('/workspace');
    await page.getByRole('application').focus();
    await page.keyboard.press('m');
    const box = (await page.getByRole('menu', { name: 'Radial menu' }).boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy - 75); // Add
    await page.mouse.move(cx, cy - 150); // first outer item: Sphere
    await page.mouse.click(cx, cy - 150);
    await expect(
      page.getByRole('list', { name: 'Objects in the scene' }).getByRole('listitem'),
    ).toHaveCount(4);
    await expect(page.getByRole('menu', { name: 'Radial menu' })).toBeHidden();
  });
});
