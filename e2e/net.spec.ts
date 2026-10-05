import { type Browser, type BrowserContext, type Page, expect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

// A context made by hand outlives its test: close it, with its PeerJS connection.
const opened: BrowserContext[] = [];

test.afterEach(async () => {
  await Promise.all(opened.splice(0).map((context) => context.close()));
});

async function newPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  opened.push(context);
  return context.newPage();
}

async function seatsOf(page: Page): Promise<string[]> {
  return page.locator('#seats li').allTextContents();
}

async function host(page: Page): Promise<string> {
  await page.goto('./dev/net.html');
  await page.locator('#name').fill('Hôte');
  await page.getByRole('button', { name: 'Créer un salon' }).click();
  await expect(page.locator('#status')).toHaveText('salon ouvert');
  const code = await page.locator('#room-code').textContent();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  return code ?? '';
}

test('two pages meet through the local broker and see two seats', async ({ browser }) => {
  const hostPage = await newPage(browser);
  const guestPage = await newPage(browser);
  const errors = [...collectConsoleErrors(hostPage), ...collectConsoleErrors(guestPage)];

  const code = await host(hostPage);
  await guestPage.goto('./dev/net.html');
  await guestPage.locator('#name').fill('Invité');
  await guestPage.locator('#code').fill(code.toLowerCase());
  await guestPage.getByRole('button', { name: 'Rejoindre' }).click();

  await expect(guestPage.locator('#status')).toHaveText('dans le salon');
  for (const page of [hostPage, guestPage]) {
    await expect.poll(() => seatsOf(page)).toHaveLength(2);
    expect(await seatsOf(page)).toEqual([
      expect.stringContaining('Hôte'),
      expect.stringContaining('Invité'),
    ]);
  }
  expect(errors).toEqual([]);
});

test('a guest joins from the link fragment', async ({ browser }) => {
  const hostPage = await newPage(browser);
  const guestPage = await newPage(browser);

  const code = await host(hostPage);
  await guestPage.goto(`./dev/net.html#rejoindre=${code}`);

  await expect(guestPage.locator('#status')).toHaveText('dans le salon');
  await expect.poll(() => seatsOf(hostPage)).toHaveLength(2);
});

test('a different version is refused with the reason and the host version', async ({ browser }) => {
  const hostPage = await newPage(browser);
  const guestPage = await newPage(browser);

  const code = await host(hostPage);
  await guestPage.goto(`./dev/net.html?version=autre#rejoindre=${code}`);

  await expect(guestPage.locator('#status')).toHaveText('refusé: version');
  const hostVersion = await hostPage.locator('#version').textContent();
  expect(hostVersion).toBeTruthy();
  await expect(guestPage.locator('#log')).toContainText(`version de l'hôte ${hostVersion ?? ''}`);
  expect(await seatsOf(hostPage)).toHaveLength(1);
});

test('an unknown code fails with an explicit error', async ({ page }) => {
  await page.goto('./dev/net.html');
  await page.locator('#code').fill('ZZZZZZ');
  await page.getByRole('button', { name: 'Rejoindre' }).click();

  await expect(page.locator('#status')).toHaveText('échec', { timeout: 20_000 });
  await expect(page.locator('#error')).toContainText('no room with the code ZZZZZZ');
});
