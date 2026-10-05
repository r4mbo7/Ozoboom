import { type Page, expect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

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
  const hostPage = await (await browser.newContext()).newPage();
  const guestPage = await (await browser.newContext()).newPage();
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
  const hostPage = await (await browser.newContext()).newPage();
  const guestPage = await (await browser.newContext()).newPage();

  const code = await host(hostPage);
  await guestPage.goto(`./dev/net.html#rejoindre=${code}`);

  await expect(guestPage.locator('#status')).toHaveText('dans le salon');
  await expect.poll(() => seatsOf(hostPage)).toHaveLength(2);
});

test('a different version is refused with the reason and the host version', async ({ browser }) => {
  const hostPage = await (await browser.newContext()).newPage();
  const guestPage = await (await browser.newContext()).newPage();

  const code = await host(hostPage);
  await guestPage.goto(`./dev/net.html?version=autre#rejoindre=${code}`);

  await expect(guestPage.locator('#status')).toHaveText('refusé: version');
  await expect(guestPage.locator('#log')).toContainText("version de l'hôte dev");
  expect(await seatsOf(hostPage)).toHaveLength(1);
});

test('an unknown code fails with an explicit error', async ({ page }) => {
  await page.goto('./dev/net.html');
  await page.locator('#code').fill('ZZZZZZ');
  await page.getByRole('button', { name: 'Rejoindre' }).click();

  await expect(page.locator('#status')).toHaveText('échec', { timeout: 20_000 });
  await expect(page.locator('#error')).toContainText('no room with the code ZZZZZZ');
});
