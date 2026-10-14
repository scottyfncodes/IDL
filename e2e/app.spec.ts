import { expect, test, type Page } from '@playwright/test';

const ROOM = ['dots-boxes', 'connect-four', 'battleship', 'sudoku', 'mystery-grid', 'tic-tac-toe', 'memory-match'];
const DAILY = ['linkup', 'wordcraft', 'sumwise', 'deduction', 'pattern', 'wordsteps'];

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

test('main navigation works and shows the three destinations', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByText(/Today’s edition/)).toBeVisible();
  await expect(page.locator('.lineup__item')).toHaveCount(6);
  await noOverflow(page);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Play' }).click();
  await expect(page.getByRole('heading', { name: /Play anywhere/ })).toBeVisible();
  await expect(page.locator('.game-card')).toHaveCount(ROOM.length);
  await noOverflow(page);

  await page.getByRole('button', { name: /Two-Player Road Trip/ }).click();
  await expect(page.getByRole('heading', { name: 'Two-Player Road Trip' })).toBeVisible();
  for (const card of await page.locator('.game-card').all()) await expect(card).toContainText(/2 players/);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Library' }).click();
  await expect(page.getByRole('heading', { name: 'The archive' })).toBeVisible();
  await noOverflow(page);
  expect(errors).toEqual([]);
});

for (const id of ROOM) {
  test(`room game ${id} opens without layout overflow or errors`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`/#/play/${id}`);
    await expect(page.locator('.game-bar h1')).toBeVisible();
    await expect(page.getByText('Stub')).toHaveCount(0);
    await page.waitForTimeout(300);
    await noOverflow(page);
    await page.getByRole('button', { name: 'How to play' }).click();
    await expect(page.locator('dialog[open] .rules')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
}

for (const id of DAILY) {
  test(`daily ${id} opens for today and an archive date`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`/#/daily/${id}`);
    await expect(page.locator('.game-bar h1')).toBeVisible();
    await expect(page.locator('.game-bar__kicker')).toContainText('Today');
    await noOverflow(page);
    await page.goto(`/#/daily/${id}/2026-09-01`);
    await expect(page.locator('.game-bar__kicker')).toContainText('No. 1');
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
}

test('future editions are not playable', async ({ page }) => {
  await page.goto('/#/daily/linkup/2099-01-01');
  await expect(page.getByRole('heading', { name: 'Not published yet' })).toBeVisible();
});

test('tic-tac-toe plays to a win and persists across reloads', async ({ page }) => {
  await page.goto('/#/play/tic-tac-toe');
  const cell = (r: number, c: number) => page.getByRole('gridcell', { name: new RegExp(`^Row ${r}, column ${c}`) });
  await cell(1, 1).click();
  await cell(2, 1).click();
  await page.reload();
  await expect(cell(1, 1)).toHaveAccessibleName(/Player 1/);
  await cell(1, 2).click();
  await cell(2, 2).click();
  await cell(1, 3).click();
  await expect(page.locator('.status-line')).toHaveText('Player 1 wins the round');
  await expect(cell(3, 3)).toBeDisabled();
  await page.getByRole('button', { name: 'Rematch' }).click();
  await expect(page.locator('.status-line')).toHaveText('Player 2 to move');
});

test('a finished daily puzzle is remembered on Today', async ({ page }) => {
  await page.goto('/#/today');
  await page.evaluate(() => {
    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem(`idl:daily:pattern:${key}`, JSON.stringify({ v: 1, at: Date.now(), data: { status: 'won', state: null, result: { score: '3/3' }, updatedAt: Date.now() } }));
  });
  await page.reload();
  await expect(page.locator('.lineup__item[data-state="won"]')).toHaveCount(1);
  await expect(page.locator('.edition-progress')).toContainText('1 of 6 finished');
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('/#/today');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
    return reg.active?.state;
  });
  // Precache must be complete before we drop the network.
  await page.waitForFunction(async () => {
    const names = await caches.keys();
    return names.some((n) => n.startsWith('idl-shell-'));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.lineup__item')).toHaveCount(6);
  await expect(page.getByText(/Offline · all games work/)).toBeVisible();
  for (const id of ROOM) {
    await page.goto(`/#/play/${id}`);
    await expect(page.locator('.game-bar h1')).toBeVisible();
    await expect(page.getByText('Couldn’t open this game')).toHaveCount(0);
  }
  for (const id of DAILY) {
    await page.goto(`/#/daily/${id}`);
    await expect(page.locator('.game-bar h1')).toBeVisible();
    await expect(page.getByText('Couldn’t open this game')).toHaveCount(0);
  }
  // A cold start offline (new tab) also boots.
  const fresh = await context.newPage();
  await fresh.goto('/#/play');
  await expect(fresh.locator('.game-card').first()).toBeVisible();
  await context.setOffline(false);
});
