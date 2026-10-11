import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

test('Jouer plays the class chosen after it, and the next visit proposes it again', async ({
  page,
}) => {
  // Without a GPU, the reload first frees the running game's WebGL context in software: on a busy
  // machine the old page holds the tab blank for up to twenty seconds before the new one parses.
  test.setTimeout(90_000);
  const errors = collectConsoleErrors(page);
  await page.goto('./?dev=fast');
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  const classes = page.getByRole('radiogroup', { name: 'Classes' });
  await expect(classes.getByRole('radio', { name: 'La Luxiole' })).toBeChecked();

  await classes.getByRole('radio', { name: 'Le Nounours' }).click();
  await page.getByRole('button', { name: 'Lancer le set' }).click();

  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  expect(await page.evaluate(() => window.ozoboom?.state.players[0]?.classId)).toBe('tank');
  expect(await page.evaluate(() => window.ozoboom?.seats)).toEqual([
    { playerId: 0, name: null, classId: 'tank', device: null, local: true },
  ]);

  await page.reload({ waitUntil: 'commit' });
  await page.getByRole('button', { name: 'Jouer', exact: true }).click({ timeout: 60_000 });
  await expect(
    page.getByRole('radiogroup', { name: 'Classes' }).getByRole('radio', { name: 'Le Nounours' }),
  ).toBeChecked();
  expect(errors).toEqual([]);
});
