import { expect, test, type Page } from '@playwright/test';

/**
 * Short-screen layout checks. iPhone SE / mini class phones are 375×667 CSS
 * px; 320×568 is checked for "nothing breaks" only.
 */
const SHORT_PHONE = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`no box for ${selector}`);
  return b;
}
const noHorizontalOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

async function startSudoku(page: Page) {
  await page.goto('/#/play/sudoku');
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('group', { name: 'Sudoku board' })).toBeVisible();
}

test.describe('short phone (375×667)', () => {
  test.beforeEach(() => test.skip(test.info().project.name !== 'iphone', 'phone-sized layout checks'));
  test.use(SHORT_PHONE);

  test('Sudoku: board and a 44px+ keypad fit on one screen', async ({ page }) => {
    await startSudoku(page);
    const board = await box(page, '.sdk-board');
    expect(board.width).toBeGreaterThanOrEqual(355);
    const keys = page.locator('.sdk-keys button');
    await expect(keys).toHaveCount(12);
    for (const k of await keys.all()) {
      const b = (await k.boundingBox())!;
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.y + b.height).toBeLessThanOrEqual(667);
    }
    await noHorizontalOverflow(page);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(667);
  });

  test('Sudoku: a tap on a grid line still selects a square, and digits enter', async ({ page }) => {
    await startSudoku(page);
    const b = await box(page, '.sdk-board');
    const pitch = b.width / 9;
    // Exactly on the line between rows 5/6 and columns 2/3.
    await page.touchscreen.tap(b.x + pitch * 3, b.y + pitch * 6);
    const sel = page.locator('.sdk-cell[aria-pressed="true"]');
    await expect(sel).toHaveCount(1);
    await expect(sel).toHaveAttribute('aria-label', /^Row (6|7), column (3|4):/);
    // Find and fill an empty square by tapping its centre.
    const empty = page.locator('.sdk-cell[aria-label$=": empty"]').first();
    const label = (await empty.getAttribute('aria-label'))!.split(':')[0];
    const e = (await empty.boundingBox())!;
    await page.touchscreen.tap(e.x + e.width / 2, e.y + e.height / 2);
    await expect(page.locator('.sdk-cell[aria-pressed="true"]')).toHaveAttribute('aria-label', new RegExp(`^${label}:`));
    await page.getByRole('button', { name: /^7, / }).tap();
    await expect(page.locator('.sdk-cell[aria-pressed="true"]')).toHaveAttribute('aria-label', new RegExp(`^${label}: 7`));
    // Progress survives a reload (which auto-pauses the clock).
    await page.reload();
    await page.getByRole('button', { name: 'Resume' }).first().click();
    await expect(page.getByRole('button', { name: new RegExp(`^${label}: 7`) })).toBeVisible();
  });

  test('Battleship: setup fits with Ready on screen', async ({ page }) => {
    await page.goto('/#/play/battleship');
    await page.getByRole('button', { name: /place my fleet/ }).click();
    await page.getByRole('button', { name: /Random fleet/ }).click();
    const ready = page.getByRole('button', { name: 'Ready' });
    await expect(ready).toBeEnabled();
    const r = (await ready.boundingBox())!;
    expect(r.y + r.height).toBeLessThanOrEqual(667);
    expect(r.height).toBeGreaterThanOrEqual(44);
    for (const ship of await page.locator('.bs-dock__ship').all()) expect((await ship.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await noHorizontalOverflow(page);
    // Privacy unchanged: after Ready, the handoff shows no board.
    await ready.click();
    await expect(page.getByText('Pass the phone to Player 2')).toBeVisible();
    await expect(page.locator('.bs-board')).toHaveCount(0);
  });

  for (const [mode, size, heading] of [
    ['Solo', '4 × 4', /moves/],
    ['2 players', '4 × 6', /wins|tie/],
  ] as const) {
    test(`Memory Match: ${mode} ${size} result is on screen when the board clears`, async ({ page }) => {
      await page.goto('/#/play/memory-match');
      await page.getByRole('radio', { name: size }).click();
      await page.getByRole('radio', { name: mode === 'Solo' ? '2 players' : 'Solo' }).click();
      await page.getByRole('radio', { name: mode }).click();
      const deck: string[] = await page.evaluate(() => JSON.parse(localStorage.getItem('idl:room:memory-match')!).data.match.deck);
      const done = new Set<number>();
      for (let i = 0; i < deck.length; i++) {
        if (done.has(i)) continue;
        const p = deck.findIndex((x, k) => k !== i && x === deck[i]);
        done.add(i).add(p);
        await page.getByRole('button', { name: new RegExp(`^Card ${i + 1},`) }).click();
        await page.getByRole('button', { name: new RegExp(`^Card ${p + 1},`) }).click();
      }
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      const again = page.getByRole('button', { name: 'Play again' });
      const a = (await again.boundingBox())!;
      expect(a.y + a.height).toBeLessThanOrEqual(667);
      await expect(again).toBeFocused();
      await page.getByRole('button', { name: 'View board' }).click();
      await expect(page.locator('.mm-result')).toHaveCount(0);
      await page.getByRole('button', { name: 'Play again' }).click();
      await expect(page.getByRole('button', { name: /^Card 1, face down$/ })).toBeVisible();
    });
  }
});

test.describe('smallest phone (320×568)', () => {
  test.beforeEach(() => test.skip(test.info().project.name !== 'iphone', 'phone-sized layout checks'));
  test.use({ ...SHORT_PHONE, viewport: { width: 320, height: 568 } });

  test('Sudoku, Battleship setup and Memory Match never overflow sideways', async ({ page }) => {
    await startSudoku(page);
    await noHorizontalOverflow(page);
    for (const k of await page.locator('.sdk-keys button').all()) expect((await k.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.goto('/#/play/battleship');
    await page.getByRole('button', { name: /place my fleet/ }).click();
    await noHorizontalOverflow(page);
    await page.goto('/#/play/memory-match');
    await noHorizontalOverflow(page);
  });
});

test.describe('desktop Sudoku', () => {
  test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop only'));

  test('board and keypad sit on one screen and the keyboard drives play', async ({ page }) => {
    await startSudoku(page);
    const k = await box(page, '.sdk-keys');
    expect(k.y + k.height).toBeLessThanOrEqual(800);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.sdk-cell[aria-pressed="true"]')).toHaveAttribute('aria-label', /^Row 5, column 5:/);
    await page.keyboard.press('n');
    await expect(page.getByRole('button', { name: 'Notes on' })).toHaveAttribute('aria-pressed', 'true');
  });
});
