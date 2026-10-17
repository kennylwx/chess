import { test, expect } from '@playwright/test';
test('captures the local chess UI', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.terminal')).toBeVisible();
  await expect(page.locator('#load')).toBeVisible();
  await page.locator('#play').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('#board svg')).toBeVisible();
  await expect(page.locator('#board .piece')).toHaveCount(32);
  await expect(page.locator('#board .coordinate').first()).toHaveAttribute('x', '12');
  await expect(page.locator('#board .coordinate').last()).toHaveAttribute('y', '762');
  await expect(page.locator('#moves')).toHaveText('Moves: —');
  await expect(page.getByPlaceholder('e4, Nf3, or describe your move…')).toBeFocused();
  await page.screenshot({ path: 'screenshots/chess-terminal.png', fullPage: true });
});
