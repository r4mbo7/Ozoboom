import { expect as baseExpect, test, type Locator, type Page } from './test';
import { cardsDealt, collectConsoleErrors, logsOf, repeatUntil } from './game';

// A machine busy with other browsers draws a frame of a menu in seconds: every wait is patient.
const expect = baseExpect.configure({ timeout: 30_000 });

const PHONE = { width: 390, height: 844 };

// A menu ignores presses for a moment: press again only while the selection has not moved yet.
async function stepRight(page: Page, cards: Locator, from: number): Promise<void> {
  const isCurrent = async (index: number) =>
    (await cards.nth(index).getAttribute('aria-current')) === 'true';
  await repeatUntil(
    async () => {
      if (await isCurrent(from)) {
        await page.keyboard.press('ArrowRight');
      }
    },
    () => isCurrent(from + 1),
  );
}

test('a relic offer of four cards is titled, gold and navigable by keyboard', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('/dev/ui.html?screen=relics');
  const offer = page.getByRole('region', { name: 'Choix d’amélioration' });
  const cards = offer.getByRole('button');

  await expect(offer.getByRole('heading', { name: 'Le boss lâche une relique' })).toBeVisible();
  await expect(cards).toHaveCount(4);
  await expect(cards.first()).toHaveAttribute('aria-current', 'true');
  await expect(cards.nth(3)).toHaveAttribute('data-tint', 'relic');
  await stepRight(page, cards, 0);
  await stepRight(page, cards, 1);

  await expect(cards.nth(2)).toHaveAttribute('aria-current', 'true');
  expect(errors).toEqual([]);
});

test('a relic offer fits a phone width without scrolling sideways', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto('/dev/ui.html?screen=relics');
  const cards = page.getByRole('region', { name: 'Choix d’amélioration' }).getByRole('button');
  await expect(cards).toHaveCount(4);
  await cardsDealt(page);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const boxes = await cards.evaluateAll((nodes) =>
    nodes.map((node) => {
      const { left, right } = node.getBoundingClientRect();
      return { left, right };
    }),
  );

  expect(overflow).toBe(0);
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(PHONE.width);
  }
});

test('a mixed offer shows the rarity, the sixteenth notes of a weapon and the rank', async ({
  page,
}) => {
  await page.goto('/dev/ui.html?screen=upgrade');
  const offer = page.getByRole('region', { name: 'Choix d’amélioration' });

  await expect(offer.getByText('Rare', { exact: true })).toBeVisible();
  await expect(offer.getByRole('img', { name: 'Rang 2 sur 3' }).locator('.ui-pearl')).toHaveCount(
    3,
  );
  await expect(offer.locator('.ui-pearl[data-gain]')).toHaveCount(3);
  await expect(offer.locator('.ui-card__medal')).toHaveCount(3);
  await expect(
    offer.getByRole('img', { name: /Tire sur les doubles croches 1, 5, 9, 13/ }),
  ).toBeVisible();
  await expect(offer.locator('.ui-card__step[data-on="true"]')).toHaveCount(4);
});

const menuLogs = (logs: readonly string[]) =>
  logs.filter((line) => /^\[ui\] on(UpgradeCue|ChooseUpgrade)/.test(line));

test('an offer is dealt on rising notes, the rare card then the legendary one last', async ({
  page,
}) => {
  const logs = logsOf(page);
  await page.goto('/dev/ui.html?screen=upgrade');
  const cards = page.getByRole('region', { name: 'Choix d’amélioration' }).getByRole('button');
  await expect(cards).toHaveCount(3);

  await expect(cards.first()).toHaveAttribute('aria-current', 'true');

  await expect
    .poll(() => menuLogs(logs))
    .toEqual([
      '[ui] onUpgradeCue cardDealt 0',
      '[ui] onUpgradeCue cardDealt 1',
      '[ui] onUpgradeCue cardRare 0',
      '[ui] onUpgradeCue cardDealt 2',
      '[ui] onUpgradeCue cardLegendary 0',
      '[ui] onUpgradeCue cardsReady 0',
    ]);
  await expect(cards.nth(1)).toHaveAttribute('data-shine', '');
});

test('a choice slams before it is sent, then the card lands in the HUD as the menu closes', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  const logs = logsOf(page);
  await page.goto('/dev/ui.html?screen=upgrade');
  const offer = page.getByRole('region', { name: 'Choix d’amélioration' });
  const cards = offer.getByRole('button');
  await expect(cards.first()).toHaveAttribute('aria-current', 'true');

  await page.keyboard.press('Enter');

  const dealt = page.locator('.ui-card');
  await expect(dealt.first()).toHaveAttribute('data-slammed', '');
  await expect(dealt.nth(1)).toHaveAttribute('data-dropped', 'right');
  await expect(offer).toBeHidden();
  await expect
    .poll(() => menuLogs(logs).slice(-4))
    .toEqual([
      '[ui] onUpgradeCue upgradeChosen 0',
      '[ui] onChooseUpgrade 0 nova-elargie',
      '[ui] onUpgradeCue cardFlight 0',
      '[ui] onUpgradeCue cardLanded 0',
    ]);
  expect(errors).toEqual([]);
});

test('in calm mode a choice is sent at once and nothing moves', async ({ page }) => {
  const logs = logsOf(page);
  await page.goto('/dev/ui.html?screen=upgrade&calm');
  const offer = page.getByRole('region', { name: 'Choix d’amélioration' });
  const cards = offer.getByRole('button');
  await expect(cards.first()).toHaveAttribute('aria-current', 'true');
  expect(await cards.first().evaluate((node) => node.getAnimations().length)).toBe(0);

  await page.keyboard.press('Enter');

  await expect(offer).toBeHidden();
  await expect
    .poll(() => menuLogs(logs).slice(-4))
    .toEqual([
      '[ui] onUpgradeCue upgradeChosen 0',
      '[ui] onChooseUpgrade 0 nova-elargie',
      '[ui] onUpgradeCue cardFlight 0',
      '[ui] onUpgradeCue cardLanded 0',
    ]);
  await expect(page.locator('.ui-sparks > *')).toHaveCount(0);
});
