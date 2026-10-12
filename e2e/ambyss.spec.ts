import { expect, test } from './test';
import {
  PAD,
  PAD_SEED,
  collectConsoleErrors,
  playWithPad,
  plugFakeGamepad,
  tapButtonUntil,
} from './game';

// Ambyss plays a fifth slower than the main stage: its short set of `?dev=fast` lasts longer.
test.describe.configure({ timeout: 420_000 });

test('picks Ambyss on the stage screen and plays a whole game there, to the sunrise', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await plugFakeGamepad(page);
  await page.goto(`./?dev=fast&stages&seed=${String(PAD_SEED)}`);
  const stages = page.getByRole('radiogroup', { name: 'Scènes' });
  const ambyss = stages.getByRole('radio', { name: /Ambyss/ });
  await tapButtonUntil(page, PAD.A, () => stages.isVisible());
  await expect(stages.getByRole('radio', { name: /Main stage/ })).toBeChecked();
  await tapButtonUntil(page, PAD.DpadRight, () => ambyss.isChecked());
  const hud = page.getByRole('region', { name: 'Pièges' });

  const { status, upgrades } = await playWithPad(page, async () => {
    await tapButtonUntil(page, PAD.A, () => hud.isVisible());
    expect(await page.evaluate(() => window.ozoboom?.state.setId)).toBe('ambyss');
  });
  expect(status).toBe('won');
  expect(upgrades).toBeGreaterThan(0);
  const end = page.getByRole('region', { name: 'Fin de partie' });
  await expect(end).toBeVisible();
  await expect(end).toContainText('Sunrise');
  expect(errors).toEqual([]);
});
