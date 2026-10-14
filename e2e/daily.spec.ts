import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRng } from '../src/lib/rng';
import { dayNumber } from '../src/lib/date';

// Mirrors wordcraft/logic.ts answerFor (that module imports JSON, which the
// Playwright loader can't); the unit tests pin the real function.
function answerFor(date: string): string {
  const words = (JSON.parse(readFileSync('src/content/words/answers5.json', 'utf8')) as { words: string[] }).words.map((w) => w.toLowerCase());
  const order = createRng('wordcraft:v1:order').shuffle(words);
  return order[dayNumber(date) % order.length];
}

const ARCHIVE_DATE = '2026-09-15';

test('solve a Wordcraft edition, keep the result, share without spoilers', async ({ page, context, browserName }, info) => {
  const answer = answerFor(ARCHIVE_DATE);
  await page.goto(`/#/daily/wordcraft/${ARCHIVE_DATE}`);
  await expect(page.getByRole('group', { name: 'Keyboard' })).toBeVisible();
  // The answer must not be anywhere in the page before the game ends.
  expect((await page.content()).toLowerCase()).not.toContain(`>${answer}<`);

  // An invalid guess does not use a turn.
  for (const l of 'zzzzz') await page.keyboard.press(l);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Not in the word list')).toBeVisible();
  for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');

  for (const l of answer) await page.keyboard.press(l);
  await page.keyboard.press('Enter');
  const panel = page.locator('.completion');
  await expect(panel).toBeVisible({ timeout: 10_000 });
  await expect(panel.locator('.completion__score')).toHaveText('1/6');
  await expect(panel).toContainText(answer.toUpperCase());

  // Persisted: reload shows the finished state, and the archive lineup knows.
  await page.reload();
  await expect(page.locator('.completion__score')).toHaveText('1/6');
  await page.goto(`/#/edition/${ARCHIVE_DATE}`);
  await expect(page.locator('.lineup__item[data-state="won"]')).toHaveCount(1);

  if (info.project.name === 'desktop' && browserName === 'chromium') {
    // Desktop uses the clipboard fallback rather than the native sheet.
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`/#/daily/wordcraft/${ARCHIVE_DATE}`);
    await page.getByRole('button', { name: 'Share result' }).click();
    await expect(page.getByText('Result copied — no spoilers')).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('idl Wordcraft · No. 15');
    expect(text).toContain('🟩🟩🟩🟩🟩');
    expect(text.toLowerCase()).not.toContain(answer);
  }
});
