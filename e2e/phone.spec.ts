import { type Locator, expect, test } from './test';
import { cardsDealt } from './game';

async function expectWholeIn(texts: Locator, frame: string): Promise<void> {
  for (const text of await texts.all()) {
    await expect(text).toBeVisible();
    const fits = await text.evaluate((node, selector) => {
      const outer = node.closest(selector);
      if (outer === null) throw new Error(`No ${selector}`);
      const style = getComputedStyle(outer);
      const room = outer.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      return (
        node.scrollWidth <= node.clientWidth &&
        box.left >= room.left + parseFloat(style.paddingLeft) &&
        box.right <= room.right - parseFloat(style.paddingRight) &&
        room.left >= 0 &&
        room.right <= window.innerWidth
      );
    }, frame);
    expect(fits, await text.innerText()).toBe(true);
  }
}

test.describe('a phone held upright', () => {
  test.use({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });

  test('shows every class name whole on the class picker', async ({ page }) => {
    await page.goto('./?dev=fast');
    await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
    await expectWholeIn(page.locator('.ui-classcard__name'), '.ui-classcard');
  });

  for (const [mode, screen] of [
    ['Jouer', 'Choix du perso'],
    ['Jouer à plusieurs', 'Salon'],
  ] as const) {
    test(`asks to turn the phone sideways after « ${mode} »`, async ({ page }) => {
      await page.goto('./?dev=fast');
      await page.getByRole('button', { name: mode, exact: true }).tap();

      const region = page.getByRole('region', { name: screen });

      await expect(region.getByText('Tourne ton téléphone')).toBeVisible();
      await expectWholeIn(region.locator('.ui-landscape__text'), '.ui-landscape');
    });
  }
});

test.describe('a phone held sideways', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('keeps the skill name and its state inside the action bar', async ({ page }) => {
    await page.goto('./?dev=bench');
    await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
    await page.getByRole('radio', { name: 'Le Nounours' }).tap();
    await page.getByRole('button', { name: 'Lancer le set' }).tap();
    await expect(page.locator('.ui-skill__status')).toHaveText('Prête');
    await expectWholeIn(page.locator('.ui-skill__name, .ui-skill__status'), '.ui-hud__bar');
  });

  test('picks a class without asking to turn the phone', async ({ page }) => {
    await page.goto('./?dev=fast');
    await page.getByRole('button', { name: 'Jouer', exact: true }).tap();

    const region = page.getByRole('region', { name: 'Choix du perso' });

    await expect(region.getByRole('radio', { name: 'Le Nounours' })).toBeVisible();
    await expect(region.getByText('Tourne ton téléphone')).toBeHidden();
  });

  for (const screen of ['upgrade', 'fusion', 'relics', 'won']) {
    test(`shows the whole ${screen} screen without scrolling`, async ({ page }) => {
      await page.goto(`/dev/ui.html?screen=${screen}`);
      const menu = page.locator('.ui-upgrade:not([hidden]), .ui-end:not([hidden])');
      await expect(menu.locator('button').first()).toBeVisible();
      await cardsDealt(page);

      const overflow = await menu.evaluate((node) => ({
        x: node.scrollWidth - node.clientWidth,
        y: node.scrollHeight - node.clientHeight,
      }));

      expect(overflow).toEqual({ x: 0, y: 0 });
    });
  }
});

test.describe('a short and narrow window', () => {
  test.use({ viewport: { width: 360, height: 500 } });

  test('keeps a four-card offer in one column, never wider than the window', async ({ page }) => {
    await page.goto('/dev/ui.html?screen=relics');
    const menu = page.locator('.ui-upgrade');
    await expect(menu.locator('button').first()).toBeVisible();
    await cardsDealt(page);

    const overflow = await menu.evaluate((node) => node.scrollWidth - node.clientWidth);

    expect(overflow).toBe(0);
  });
});
