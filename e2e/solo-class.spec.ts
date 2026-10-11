import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

test('Jouer plays the class chosen on the title, and the next visit proposes it again', async ({
  page,
}) => {
  // Without a GPU, the reload first frees the running game's WebGL context in software: on a busy
  // machine the old page holds the tab blank for up to twenty seconds before the new one parses.
  test.setTimeout(90_000);
  const errors = collectConsoleErrors(page);
  await page.goto('./?dev=fast');
  const picker = page.getByRole('radiogroup', { name: 'Ta classe' });
  await expect(picker.getByRole('radio', { name: 'La Luxiole' })).toBeChecked();

  await picker.getByRole('radio', { name: 'Le Nounours' }).click();
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  expect(await page.evaluate(() => window.ozoboom?.state.players[0]?.classId)).toBe('tank');
  expect(await page.evaluate(() => window.ozoboom?.seats)).toEqual([
    { playerId: 0, name: null, classId: 'tank', device: null, local: true },
  ]);

  await page.reload({ waitUntil: 'commit' });
  await expect(
    page.getByRole('radiogroup', { name: 'Ta classe' }).getByRole('radio', { name: 'Le Nounours' }),
  ).toBeChecked({ timeout: 60_000 });
  expect(errors).toEqual([]);
});
