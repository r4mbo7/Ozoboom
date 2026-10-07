import { expect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

test('Jouer plays the class chosen on the title, and the next visit proposes it again', async ({
  page,
}) => {
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

  await page.reload();
  await expect(
    page.getByRole('radiogroup', { name: 'Ta classe' }).getByRole('radio', { name: 'Le Nounours' }),
  ).toBeChecked();
  expect(errors).toEqual([]);
});
