import { type Page, expect as baseExpect, test } from '@playwright/test';
import { PAD, collectConsoleErrors, plugFakeGamepad, tapButton, tapButtonUntil } from './game';

test.describe.configure({ timeout: 120_000 });
const expect = baseExpect.configure({ timeout: 30_000 });

// Menus read one press per frame and act on its start: wait two frames so that the next press is
// a new one, whatever the speed of the machine.
async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}

function storedMute(page: Page): Promise<string | null> {
  return page.evaluate(() => window.localStorage.getItem('ozoboom.muted'));
}

test('cuts the sound from the pause and remembers it on the title', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('./?dev=fast');
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  await press(page, 'Escape');
  const pause = page.getByRole('dialog', { name: 'Pause' });
  await expect(pause).toBeVisible();
  const sound = pause.getByRole('switch', { name: /^Son/ });
  await expect(sound).toHaveAttribute('aria-checked', 'true');
  await expect(sound).toContainText('Activé');

  await press(page, 'ArrowDown');
  await expect(sound).toHaveAttribute('aria-current', 'true');
  await press(page, 'Enter');

  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await expect(sound).toContainText('Coupé');
  expect(await storedMute(page)).toBe('1');
  await expect(pause).toBeVisible();

  await sound.click();

  await expect(sound).toHaveAttribute('aria-checked', 'true');
  expect(await storedMute(page)).toBe('0');

  await sound.click();
  await expect(sound).toHaveAttribute('aria-checked', 'false');
  await press(page, 'Escape');
  await expect(pause).toBeHidden();
  await page.reload();

  await expect(page.getByRole('switch', { name: /^Son/ })).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  await press(page, 'Escape');
  await expect(pause.getByRole('switch', { name: /^Son/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expect(errors).toEqual([]);
});

test('turns on automatic fire and aim from the title and keeps them in the pause', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto('./?dev=fast');
  const autoFire = page.getByRole('switch', { name: /^Tir automatique/ });
  await expect(autoFire).toHaveAttribute('aria-checked', 'false');

  await autoFire.click();
  await page.getByRole('switch', { name: /^Visée automatique/ }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  await press(page, 'Escape');

  const pause = page.getByRole('dialog', { name: 'Pause' });
  await expect(pause.getByRole('switch', { name: /^Tir automatique/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(pause.getByRole('switch', { name: /^Visée automatique/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(errors).toEqual([]);
});

async function game(page: Page): Promise<{ seed: number; tick: number }> {
  const state = await page.evaluate(() => {
    const current = window.ozoboom?.state;
    return current === undefined ? null : { seed: current.seed, tick: current.tick };
  });
  if (state === null) {
    throw new Error('The game state is not exposed');
  }
  return state;
}

test('quits the set from the pause after a confirmation, then plays a new one', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto('./?dev=fast');
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  const traps = page.getByRole('region', { name: 'Pièges' });
  await expect(traps).toBeVisible();
  await page.keyboard.press('KeyF');
  await expect(page.getByText('1 / 6 posés')).toBeVisible();
  await press(page, 'Escape');
  const pause = page.getByRole('dialog', { name: 'Pause' });
  await expect(pause).toBeVisible();
  const paused = await game(page);
  const quitEntry = pause.getByRole('button', { name: 'Quitter la partie' });
  const confirmation = page.getByRole('alertdialog', { name: 'Quitter le set\u202f?' });
  const stay = confirmation.getByRole('button', { name: 'Rester' });
  const leave = confirmation.getByRole('button', { name: 'Quitter', exact: true });

  for (let index = 0; index < 5; index++) {
    await press(page, 'ArrowDown');
  }
  await expect(quitEntry).toHaveAttribute('aria-current', 'true');
  await press(page, 'Enter');
  await expect(confirmation).toBeVisible();
  await expect(pause).toBeHidden();
  await expect(stay).toHaveAttribute('aria-current', 'true');
  await press(page, 'Escape');

  await expect(pause).toBeVisible();
  await expect(confirmation).toBeHidden();
  await expect(quitEntry).toHaveAttribute('aria-current', 'true');
  await press(page, 'Enter');
  await expect(confirmation).toBeVisible();
  await press(page, 'Enter');

  await expect(pause).toBeVisible();
  await expect(confirmation).toBeHidden();
  expect(await game(page)).toEqual(paused);
  await quitEntry.click();
  await expect(confirmation).toBeVisible();
  await leave.click();

  const title = page.getByRole('region', { name: 'Écran titre' });
  await expect(title).toBeVisible();
  await expect(confirmation).toBeHidden();
  await expect(pause).toBeHidden();
  await expect(traps).toBeHidden();
  await expect(page.getByRole('region', { name: 'Fin de partie' })).toBeHidden();
  await expect(page.getByRole('button', { name: 'Jouer', exact: true })).toHaveAttribute(
    'aria-current',
    'true',
  );
  const quit = await game(page);
  expect(quit.seed).not.toBe(paused.seed);
  expect(quit.tick).toBe(0);

  await press(page, 'Enter');

  await expect(traps).toBeVisible();
  await expect(page.getByText('0 / 6 posés')).toBeVisible();
  await expect.poll(async () => (await game(page)).tick).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('quits the set with a gamepad, B going back to the pause', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await plugFakeGamepad(page);
  await page.goto('./?dev=fast');
  const traps = page.getByRole('region', { name: 'Pièges' });
  await tapButtonUntil(page, PAD.A, () => traps.isVisible());
  const pause = page.getByRole('dialog', { name: 'Pause' });
  await tapButtonUntil(page, PAD.Start, () => pause.isVisible());
  const quitEntry = pause.getByRole('button', { name: 'Quitter la partie' });
  const confirmation = page.getByRole('alertdialog', { name: 'Quitter le set\u202f?' });
  const leave = confirmation.getByRole('button', { name: 'Quitter', exact: true });

  for (let index = 0; index < 5; index++) {
    await tapButton(page, PAD.DpadDown);
  }
  await expect(quitEntry).toHaveAttribute('aria-current', 'true');
  await tapButton(page, PAD.A);
  await expect(confirmation).toBeVisible();
  await tapButton(page, PAD.B);

  await expect(pause).toBeVisible();
  await expect(confirmation).toBeHidden();
  await tapButton(page, PAD.A);
  await expect(confirmation).toBeVisible();
  await tapButton(page, PAD.DpadDown);
  await expect(leave).toHaveAttribute('aria-current', 'true');
  await tapButton(page, PAD.A);

  await expect(page.getByRole('region', { name: 'Écran titre' })).toBeVisible();
  await expect(pause).toBeHidden();
  await tapButtonUntil(page, PAD.A, () => traps.isVisible());
  await expect(page.getByText('0 / 6 posés')).toBeVisible();
  expect(errors).toEqual([]);
});
