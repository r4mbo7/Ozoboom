import { expect, test, type Locator, type Page } from '@playwright/test';
import { collectConsoleErrors, repeatUntil } from './game';

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
  await expect(offer.getByText('Rang 2 sur 3')).toBeVisible();
  await expect(
    offer.getByRole('img', { name: /Tire sur les doubles croches 1, 5, 9, 13/ }),
  ).toBeVisible();
  await expect(offer.locator('.ui-card__step[data-on="true"]')).toHaveCount(4);
});
