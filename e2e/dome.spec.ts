import { expect, test } from '@playwright/test';
import { PAD, collectConsoleErrors, playWithPad, plugFakeGamepad, tapButtonUntil } from './game';

// The Dome plays a third slower than the main stage: its short set of `?dev=fast` lasts longer.
test.describe.configure({ timeout: 420_000 });

test('picks the Dome on the stage screen and plays a whole game there, to the sunrise', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await plugFakeGamepad(page);
  await page.goto('./?dev=fast&stages');
  const stages = page.getByRole('radiogroup', { name: 'Scènes' });
  const dome = stages.getByRole('radio', { name: /Le Dome/ });
  await tapButtonUntil(page, PAD.A, () => stages.isVisible());
  await expect(stages.getByRole('radio', { name: /Main stage/ })).toBeChecked();
  await tapButtonUntil(page, PAD.DpadRight, () => dome.isChecked());
  const hud = page.getByRole('region', { name: 'Pièges' });
  await tapButtonUntil(page, PAD.A, () => hud.isVisible());
  expect(await page.evaluate(() => window.ozoboom?.state.setId)).toBe('dome');

  const { status, upgrades } = await playWithPad(page);
  expect(status).toBe('won');
  expect(upgrades).toBeGreaterThan(0);
  const end = page.getByRole('region', { name: 'Fin de partie' });
  await expect(end).toBeVisible();
  await expect(end).toContainText('Sunrise');
  expect(errors).toEqual([]);
});
