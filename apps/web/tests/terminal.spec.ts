import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('#play').click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
});

test('matches the CLI menu and loads a saved game', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.locator('#load').click();
  await expect(page.locator('.saved-game')).toHaveCount(1);
  await page.locator('.saved-game').click();
  await expect(page.locator('#game-label')).toContainText('1500 ELO');
  await expect(page.locator('#board .piece')).toHaveCount(32);
});

test('number keys navigate the terminal menus and Q ends the session', async ({ page }) => {
  await page.locator('#menu-button').click();
  await page.keyboard.press('1');
  await expect(page.locator('#menu-setup')).toBeVisible();
  await page.keyboard.press('3');
  await expect(page.locator('#menu-side')).toBeVisible();
  await page.keyboard.press('2');
  await expect(page.locator('#game-label')).toContainText('Black / Stockfish 1800 ELO');
  await page.locator('#menu-button').click();
  await page.keyboard.press('q');
  await expect(page.locator('#menu-exit')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('#menu-home')).toBeVisible();
});

test('plays a notation move against bundled local Stockfish', async ({ page }) => {
  const serverCalls: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/')) serverCalls.push(request.url()); });
  await page.getByPlaceholder('e4, Nf3, or describe your move…').fill('e2e4');
  await page.getByRole('button', { name: 'Enter' }).click();
  await expect(page.locator('#moves')).toContainText('1. e4');
  await expect(page.locator('#moves')).toContainText(/1\. e4 [a-z][a-z0-9+#=]*/i);
  await expect(page.locator('#board .piece')).toHaveCount(32);
  expect(serverCalls).toEqual([]);
});

test('undo shortcut restores the last turn and move row', async ({ page }) => {
  await page.locator('#board [data-square="e2"]').click();
  await expect(page.locator('#board [data-square="e4"]')).toHaveAttribute('aria-label', /legal move/);
  await page.locator('#board [data-square="e4"]').click();
  await expect(page.locator('#moves')).toContainText('1. e4');
  await page.keyboard.press('Control+u');
  await expect(page.locator('#moves')).toHaveText('Moves: —');
  await expect(page.locator('#board [data-square="e2"] .piece')).toHaveAttribute('data-piece', 'P');
});

test('keeps invalid pinned moves local and explains the pin', async ({ page }) => {
  await page.getByPlaceholder('e4, Nf3, or describe your move…').fill('fen k3r3/8/8/8/3p4/8/4N3/4K3 w - - 0 1');
  await page.keyboard.press('Enter');
  await page.getByPlaceholder('e4, Nf3, or describe your move…').fill('Nc3');
  await page.keyboard.press('Enter');
  await expect(page.locator('#output')).toContainText('Knight e2 is pinned by rook e8');
  await expect(page.locator('#moves')).toHaveText('Moves: —');
});

test('strict capture notation suggests a legal capture without playing it', async ({ page }) => {
  await page.getByPlaceholder('e4, Nf3, or describe your move…').fill('fen k7/8/8/8/4r3/3K4/8/8 w - - 0 1');
  await page.keyboard.press('Enter');
  await page.getByPlaceholder('e4, Nf3, or describe your move…').fill('Ke4');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Play suggested move Kxe4' })).toBeVisible();
  await expect(page.locator('#moves')).toHaveText('Moves: —');
});

test('supports help and position commands', async ({ page }) => {
  const input = page.getByPlaceholder('e4, Nf3, or describe your move…');
  await page.locator('#help').click();
  await expect(page.locator('#output')).toContainText('Ctrl+U undoes');
  await input.fill('fen'); await input.press('Enter');
  await expect(page.locator('#output')).toContainText('rnbqkbnr/pppppppp');
});
