import { expect, test } from '@playwright/test';
import { CLIP_CEILING } from '../src/audio/master';
import { collectConsoleErrors } from './game';

test('the sounds of the team and the lobby render in 20 seconds without clipping the master chain', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);

  await page.goto('dev/audio.html');
  await page.locator('[data-sounds]').click();
  await expect(page.locator('[data-out="sounds"]')).toHaveText('20 s', { timeout: 90_000 });

  const text = (await page.locator('[data-out="soundsPeak"]').textContent()) ?? '';
  expect(Number(text.split(' ')[0])).toBeLessThan(CLIP_CEILING);
  expect(Number(/(\d+) échantillons/.exec(text)?.[1])).toBe(0);
  await expect(page.locator('[data-out="soundsDownload"]')).toBeVisible();
  expect(errors).toEqual([]);
});
