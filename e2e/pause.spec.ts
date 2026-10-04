import { type Page, expect as baseExpect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

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
  await page.getByRole('button', { name: 'Jouer' }).click();
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
  await page.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  await press(page, 'Escape');
  await expect(pause.getByRole('switch', { name: /^Son/ })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expect(errors).toEqual([]);
});
