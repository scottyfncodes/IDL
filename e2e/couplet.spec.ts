import { expect, test, type Page } from '@playwright/test';
import { boardFor, type Board, type Placement } from '../src/games/daily/couplet/logic';

const DATE = '2026-09-20';

/** Place a domino the way a player would without dragging: tap it, tap to turn, tap a square. */
async function placeByTaps(page: Page, board: Board, p: Placement) {
  const tray = page.getByRole('list', { name: 'Dominoes to place' });
  const [x, y] = board.dominoes[p.d];
  const tile = tray.getByRole('button', { name: new RegExp(`^Domino ${x} and ${y}`) });
  await tile.click();
  const dir = p.b === p.a + 1 ? 0 : p.b === p.a + board.w ? 1 : p.b === p.a - 1 ? 2 : 3;
  for (let i = 0; i < dir; i++) await tile.click();
  const r = Math.floor(p.a / board.w) + 1;
  const c = (p.a % board.w) + 1;
  await page.getByRole('button', { name: new RegExp(`^Row ${r}, column ${c},`) }).click();
}

test('Couplet: walkthrough, drag, undo, saved progress and a solved board', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`/#/daily/couplet/${DATE}`);
  await expect(page.getByText('Lay every domino so each region keeps its rule.')).toBeVisible();

  // Drag a tray domino onto the practice board with the mouse.
  const tile = page.getByRole('list', { name: 'Dominoes to place' }).getByRole('button').first();
  const cell = page.getByRole('button', { name: /^Row 1, column 2,/ });
  const from = (await tile.boundingBox())!;
  const to = (await cell.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator('.cp-placed')).toHaveCount(1);

  await page.getByRole('button', { name: 'Skip the walkthrough' }).click();
  await expect(page.getByRole('tab', { name: /Easy/ })).toHaveAttribute('aria-selected', 'true');
  const board = boardFor(DATE, 'easy');

  // Place one, undo it, place it again.
  await placeByTaps(page, board, board.solution[0]);
  await expect(page.getByText(`1 of ${board.dominoes.length} dominoes placed`)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText(`0 of ${board.dominoes.length} dominoes placed`)).toBeVisible();
  await placeByTaps(page, board, board.solution[0]);

  // Progress survives a reload, without the walkthrough coming back.
  await page.reload();
  await expect(page.getByText(`1 of ${board.dominoes.length} dominoes placed`)).toBeVisible();

  for (const p of board.solution.slice(1)) await placeByTaps(page, board, p);
  await expect(page.getByText('Easy solved')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next: Medium' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Easy/ })).toContainText('Easy');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test('Couplet hard board fits the screen and builds in reasonable time', async ({ page }) => {
  await page.goto('/#/today');
  await page.evaluate(() => localStorage.setItem('idl:couplet:intro', JSON.stringify({ v: 1, at: 0, data: true })));
  await page.goto(`/#/daily/couplet/${DATE}`);
  const t0 = Date.now();
  await page.getByRole('tab', { name: /Hard/ }).click();
  await expect(page.locator('.cp-cell').first()).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(4000);
  const box = (await page.locator('.cp-board').boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vw);
});
