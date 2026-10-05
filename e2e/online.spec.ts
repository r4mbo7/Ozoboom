import { type Browser, type Page, expect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

// Two pages play one set through the local PeerJS broker (playwright.config.ts): no Internet.
test.describe.configure({ timeout: 240_000 });

const FAST = './?dev=fast';

async function newPage(browser: Browser): Promise<Page> {
  return (await browser.newContext()).newPage();
}

function lobbyOf(page: Page) {
  return page.getByRole('region', { name: 'Salon' });
}

async function createRoom(page: Page): Promise<string> {
  await page.goto(FAST);
  await page.getByRole('button', { name: 'Jouer à plusieurs' }).click();
  await lobbyOf(page).getByRole('button', { name: 'Créer un salon' }).click();
  const code = lobbyOf(page).locator('.ui-lobby__code');
  await expect(code).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/, { timeout: 30_000 });
  return (await code.textContent()) ?? '';
}

async function joinByLink(page: Page, code: string): Promise<void> {
  await page.goto(`${FAST}#rejoindre=${code}`);
  await expect(lobbyOf(page)).toContainText(`Tu as rejoint le salon ${code}`, { timeout: 30_000 });
}

// Both players are seated and the host starts the set.
async function launch(host: Page, guest: Page): Promise<void> {
  await expect(lobbyOf(host).getByRole('listitem').filter({ hasText: 'Joueur 2' })).toBeVisible({
    timeout: 30_000,
  });
  await lobbyOf(host).getByRole('button', { name: 'Lancer le set' }).click();
  for (const page of [host, guest]) {
    await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible({ timeout: 30_000 });
  }
}

async function status(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.ozoboom?.state.status);
}

test('two pages play a set to the end and finish on the same fingerprint', async ({ browser }) => {
  const host = await newPage(browser);
  const guest = await newPage(browser);
  const errors = [...collectConsoleErrors(host), ...collectConsoleErrors(guest)];

  const code = await createRoom(host);
  await joinByLink(guest, code);
  await launch(host, guest);

  await expect.poll(() => host.evaluate(() => window.ozoboom?.online?.role)).toBe('host');
  await expect.poll(() => guest.evaluate(() => window.ozoboom?.online?.role)).toBe('guest');

  // The guest places a trap: its action reaches the host, and comes back in the frame.
  await guest.keyboard.press('KeyF');
  for (const page of [host, guest]) {
    await expect
      .poll(() => page.evaluate(() => window.ozoboom?.state.traps.length), { timeout: 30_000 })
      .toBe(1);
  }

  for (const page of [host, guest]) {
    await expect
      .poll(() => status(page), { timeout: 200_000, intervals: [1000] })
      .toMatch(/^(won|lost)$/);
  }
  const [hostHash, guestHash] = await Promise.all(
    [host, guest].map((page) => page.evaluate(() => window.ozoboom?.hash)),
  );
  expect(hostHash).toMatch(/^[0-9a-f]{8}$/);
  expect(guestHash).toBe(hostHash);
  const [hostTick, guestTick] = await Promise.all(
    [host, guest].map((page) => page.evaluate(() => window.ozoboom?.state.tick)),
  );
  expect(guestTick).toBe(hostTick);

  await expect(host.getByRole('button', { name: 'Rejouer' })).toBeVisible();
  await expect(
    guest.getByRole('region', { name: 'Fin de partie' }).getByText('En attente de l’hôte'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('a guest with another version of the game is refused', async ({ browser }) => {
  const host = await newPage(browser);
  const guest = await newPage(browser);

  const code = await createRoom(host);
  await guest.goto(FAST);
  await guest.evaluate(() => {
    if (window.ozoboom !== undefined) {
      window.ozoboom.forceVersion = 'autre-version';
    }
  });
  await guest.getByRole('button', { name: 'Jouer à plusieurs' }).click();
  await lobbyOf(guest).getByRole('textbox', { name: 'Code du salon' }).fill(code);
  await lobbyOf(guest).getByRole('button', { name: 'Rejoindre' }).click();

  await expect(lobbyOf(guest)).toContainText('Recharge la page', { timeout: 30_000 });
  await expect(lobbyOf(host)).not.toContainText('Joueur 2');
});

test('the guest sees a notice when the host closes the page', async ({ browser }) => {
  const host = await newPage(browser);
  const guest = await newPage(browser);

  const code = await createRoom(host);
  await joinByLink(guest, code);
  await launch(host, guest);

  await host.close();

  await expect(guest.getByRole('heading', { name: 'L’hôte a quitté le set' })).toBeVisible({
    timeout: 60_000,
  });
});

test('a solo game never loads PeerJS, and the first online room does', async ({ page }) => {
  // The library alone holds this string: the app code only imports it on demand.
  const loadsLibrary: Promise<boolean>[] = [];
  page.on('response', (response) => {
    if (response.url().endsWith('.js')) {
      loadsLibrary.push(response.text().then((text) => text.includes('DataConnection')));
    }
  });

  await page.goto(FAST);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  await page.waitForTimeout(1500);
  expect((await Promise.all(loadsLibrary)).some(Boolean)).toBe(false);

  await page.goto(FAST);
  await page.getByRole('button', { name: 'Jouer à plusieurs' }).click();
  await lobbyOf(page).getByRole('button', { name: 'Créer un salon' }).click();
  await expect(lobbyOf(page).locator('.ui-lobby__code')).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/, {
    timeout: 30_000,
  });
  expect((await Promise.all(loadsLibrary)).some(Boolean)).toBe(true);
});
