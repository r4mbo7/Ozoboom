import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

test('loads the self-hosted fonts and never leaves the origin during a game', async ({
  page,
  baseURL,
}) => {
  const errors = collectConsoleErrors(page);
  const origin = new URL(baseURL ?? 'http://localhost').origin;
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.origin !== origin) {
      foreign.push(request.url());
    }
  });

  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Jouer', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  // Held until it shows: a key pressed and released between two slow frames is never read.
  await page.keyboard.down('Escape');
  await expect(page.getByRole('dialog', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });
  await page.keyboard.up('Escape');

  await expect
    .poll(() =>
      page.evaluate(async () => {
        await document.fonts.ready;
        return [
          document.fonts.check('900 16px "Cinzel Decorative"'),
          document.fonts.check('700 16px "Cinzel Decorative"'),
          document.fonts.check('400 16px "Space Grotesk"'),
          document.fonts.check('700 16px "Space Grotesk"'),
        ];
      }),
    )
    .toEqual([true, true, true, true]);
  await expect(page.locator('.ui-heading').first()).toHaveCSS('font-family', /Cinzel Decorative/);
  await expect(page.locator('.ui').first()).toHaveCSS('font-family', /Space Grotesk/);
  expect(foreign).toEqual([]);
  expect(errors).toEqual([]);
});
