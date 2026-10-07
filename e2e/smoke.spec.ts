import { type Page, expect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

// Without a GPU, each page load builds the stage for seconds: a test that reloads needs more than
// the default 30 s on a busy machine.
test.describe.configure({ timeout: 120_000 });

const HUD_PANELS = ['Line-up', 'Niveau', 'Vie', 'Pièges', 'Compétence'];

async function secondsToDrop(page: Page): Promise<number> {
  const text = await page.getByRole('timer', { name: 'Drop' }).textContent();
  const match = /(\d+):(\d{2})$/.exec(text ?? '');
  if (match === null) {
    throw new Error(`No drop countdown in "${String(text)}"`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

test('plays ten seconds from the title without a console error', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = collectConsoleErrors(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();

  await expect(page.locator('canvas')).toBeVisible();
  for (const name of HUD_PANELS) {
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
  }
  const atStart = await secondsToDrop(page);
  // The countdown follows the sim ticks: ten seconds off it are ten seconds of play. Without a GPU
  // the CI renders a few frames per second and the loop slows the sim down, hence the wide budget.
  await expect
    .poll(() => secondsToDrop(page), { timeout: 120_000 })
    .toBeLessThanOrEqual(atStart - 10);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Pause' })).toBeHidden();
  expect(errors).toEqual([]);
});

test('toggles the calm mode and remembers it', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./');
  const calm = page.getByRole('switch', { name: /Mode calme/ });
  await expect(calm).toHaveAttribute('aria-checked', 'false');

  // A click acts on the page at once. A key waits for the next frame to be read, and without a GPU a
  // frame takes a second: a press can land between two reads, which made this test flaky.
  await calm.click();

  await expect(calm).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('#app')).toHaveClass(/\bcalm\b/);
  await page.reload();
  await expect(page.getByRole('switch', { name: /Mode calme/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('#app')).toHaveClass(/\bcalm\b/);
  expect(errors).toEqual([]);
});

test('starts in calm mode when the system asks for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');

  await expect(page.getByRole('switch', { name: /Mode calme/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});
