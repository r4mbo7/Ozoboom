import { type Locator, type Page, expect as baseExpect, test } from '@playwright/test';
import { collectConsoleErrors, repeatUntil } from './game';

// Every key press waits for two frames, and SwiftShader frames are slow on CI and when tests run
// in parallel: the budget of the full games, and 30 seconds per assertion instead of 5.
test.describe.configure({ timeout: 120_000 });
const expect = baseExpect.configure({ timeout: 30_000 });

declare global {
  interface Window {
    openedUrls?: string[];
  }
}

// window.open is replaced so that no test ever reaches GitHub: the test reads the URL instead.
async function interceptNewTabs(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const opened: string[] = [];
    window.openedUrls = opened;
    window.open = (url?: string | URL) => {
      opened.push(String(url));
      return { opener: null } as unknown as Window;
    };
  });
}

async function openedUrl(page: Page): Promise<URL> {
  await expect.poll(() => page.evaluate(() => window.openedUrls?.length ?? 0)).toBe(1);
  const urls = await page.evaluate(() => window.openedUrls ?? []);
  return new URL(urls[0] ?? '');
}

// Menus read one press per frame and act on its start: wait two frames so that the next press is
// a new one, whatever the speed of the machine.
async function frames(page: Page): Promise<void> {
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

async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
  await frames(page);
}

function form(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Raconte-nous ta soirée' });
}

async function tick(page: Page): Promise<number> {
  const value = await page.evaluate(() => window.ozoboom?.state.tick);
  if (value === undefined) {
    throw new Error('The game state is not exposed');
  }
  return value;
}

// Fills and sends the form with the keyboard only: right twice is « Bug ».
async function sendBugWithKeyboard(page: Page, message: string): Promise<void> {
  const dialog = form(page);
  await expect(dialog).toBeVisible();
  await frames(page);
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  await expect(dialog.getByRole('radio', { name: 'Bug' })).toHaveAttribute('aria-checked', 'true');
  await press(page, 'ArrowDown');
  await press(page, 'Enter');
  const field = dialog.getByRole('textbox', { name: 'Ton avis' });
  await expect(field).toBeFocused();
  await page.keyboard.type(message);
  await press(page, 'Escape');
  await expect(field).not.toBeFocused();
  const send = dialog.getByRole('button', { name: 'Envoyer sur GitHub' });
  const sendSelected = async () => (await send.getAttribute('aria-current')) === 'true';
  await repeatUntil(async () => {
    if (!(await sendSelected())) {
      await press(page, 'ArrowDown');
    }
  }, sendSelected);
  await press(page, 'Enter');
  await expect(dialog.getByText('Le formulaire GitHub est ouvert')).toBeVisible();
}

function expectPrefilled(url: URL, type: string, message: string): string {
  expect(url.origin + url.pathname).toBe('https://github.com/r4mbo7/Ozoboom/issues/new');
  expect(url.searchParams.get('template')).toBe('feedback-in-game.yml');
  expect(url.searchParams.get('type')).toBe(type);
  expect(url.searchParams.get('message')).toBe(message);
  expect(url.href.length).toBeLessThanOrEqual(8000);
  const context = url.searchParams.get('context') ?? '';
  expect(context).toMatch(/^version: \S+$/m);
  expect(context).toMatch(/^browser: .+$/m);
  expect(context).toMatch(/^screen: \d+x\d+ @[\d.]+x$/m);
  expect(context).toMatch(/^fps: \d+$/m);
  return context;
}

test('sends feedback from the title, before any game', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await interceptNewTabs(page);
  await page.goto('./');
  const feedback = page.getByRole('button', { name: /^Ton avis/ });
  await expect(feedback).toBeVisible();

  for (let index = 0; index < 5; index++) {
    await press(page, 'ArrowDown');
  }
  await expect(feedback).toHaveAttribute('aria-current', 'true');
  await press(page, 'Enter');
  const message = 'Le titre est superbe.\nÇa donne envie de danser.';
  await sendBugWithKeyboard(page, message);

  const context = expectPrefilled(await openedUrl(page), 'Un bug', message);
  expect(context).toMatch(/^device: keyboardMouse$/m);
  expect(context).not.toMatch(/^seed:/m);

  await press(page, 'Escape');
  await expect(form(page)).toBeHidden();
  await frames(page);
  await expect(feedback).toHaveAttribute('aria-current', 'true');
  await expect(page.getByRole('region', { name: 'Écran titre' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('sends feedback from the pause, and the game stays paused', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await interceptNewTabs(page);
  await page.goto('./?dev=fast');
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();

  await press(page, 'Escape');
  const pause = page.getByRole('dialog', { name: 'Pause' });
  await expect(pause).toBeVisible();
  const pausedAt = await tick(page);
  await pause.getByRole('button', { name: /^Ton avis/ }).click();

  const dialog = form(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: 'Équilibrage' }).click();
  const message = 'Le premier palier est trop calme.';
  await dialog.getByRole('textbox', { name: 'Ton avis' }).fill(message);
  await dialog.getByRole('button', { name: 'Envoyer sur GitHub' }).click();
  await expect(dialog.getByText('Le formulaire GitHub est ouvert')).toBeVisible();

  const context = expectPrefilled(
    await openedUrl(page),
    'Trop dur, trop facile ou trop long',
    message,
  );
  expect(context).toMatch(/^seed: \d+$/m);
  expect(context).toMatch(/^status: running$/m);
  expect(context).toContain(`tick: ${String(pausedAt)} (`);

  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(dialog).toBeHidden();
  await expect(pause).toBeVisible();
  await frames(page);
  await frames(page);
  expect(await tick(page)).toBe(pausedAt);

  await press(page, 'Escape');
  await expect(pause).toBeHidden();
  await expect.poll(() => tick(page)).toBeGreaterThan(pausedAt);
  expect(errors).toEqual([]);
});

test('sends feedback from the end screen, with the stats of the game', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await interceptNewTabs(page);
  await page.goto('./?dev=fast');
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  // The test is about the form, not about losing: the scene goes silent until the game is lost.
  // Once is not enough, as the scene may repair itself before the sim checks the status.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const silence = () => {
          const state = window.ozoboom?.state;
          if (state === undefined) {
            reject(new Error('The game state is not exposed'));
          } else if (state.status === 'lost') {
            resolve();
          } else {
            state.core.hp = 0;
            requestAnimationFrame(silence);
          }
        };
        silence();
      }),
  );
  const end = page.getByRole('region', { name: 'Fin de partie' });
  await expect(end).toContainText('La musique s’arrête');

  const feedback = end.getByRole('button', { name: /^Ton avis/ });
  await expect
    .poll(async () => {
      await press(page, 'ArrowDown');
      return feedback.getAttribute('aria-current');
    })
    .toBe('true');
  await press(page, 'Enter');
  const message = 'J’ai perdu au premier drop.';
  await sendBugWithKeyboard(page, message);

  const context = expectPrefilled(await openedUrl(page), 'Un bug', message);
  expect(context).toMatch(/^status: lost$/m);
  expect(context).toMatch(/^stats: kills \d+, phrasesHeld \d+, damageDealt \d+/m);

  await press(page, 'Escape');
  await expect(form(page)).toBeHidden();
  await expect(end).toBeVisible();
  expect(errors).toEqual([]);
});
