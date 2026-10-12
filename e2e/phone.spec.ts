import { type Locator, expect, test } from './test';
import { cardsDealt, logsOf } from './game';

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

  test('keeps the HUD in the corners, clear of the speakers at the top and the bottom', async ({
    page,
  }) => {
    await page.goto('./?dev=bench');
    await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
    await page.getByRole('radio', { name: 'Le Nounours' }).tap();
    await page.getByRole('button', { name: 'Lancer le set' }).tap();
    const hud = page.locator('.ui-hud');
    await expect(hud.getByRole('button', { name: 'Pause' })).toBeVisible();

    const edges = async (part: Locator) => {
      const box = await part.boundingBox();
      if (box === null) throw new Error('Nothing drawn');
      return { left: box.x / 844, right: (box.x + box.width) / 844 };
    };

    for (const part of [
      hud.locator('.ui-lineup'),
      hud.getByRole('region', { name: 'Niveau' }),
      hud.getByRole('region', { name: 'Vie' }),
    ]) {
      expect((await edges(part)).right).toBeLessThanOrEqual(0.4);
    }
    for (const part of [
      hud.getByRole('button', { name: 'Pause' }),
      hud.getByRole('region', { name: 'Pièges' }),
      hud.getByRole('region', { name: 'Compétence' }),
    ]) {
      expect((await edges(part)).left).toBeGreaterThanOrEqual(0.6);
    }
    for (const part of [
      hud.getByRole('timer', { name: 'Drop' }),
      hud.getByRole('meter', { name: 'Enceintes branchées' }),
      hud.getByRole('region', { name: 'Agrès' }),
      hud.getByRole('meter', { name: 'Vie' }),
      hud.locator('.ui-skill__text'),
      hud.locator('.ui-traps__name'),
    ]) {
      await expect(part).toBeHidden();
    }
  });

  test('flies a chosen weapon card to the level ring, its gear slot being off the screen', async ({
    page,
  }) => {
    const logs = logsOf(page);
    await page.goto('/dev/ui.html?screen=fusion');
    const offer = page.getByRole('region', { name: 'Choix d’amélioration' });
    await cardsDealt(page);

    await offer.getByRole('button', { name: /Diabolo Lancé/ }).tap();

    await expect(offer).toBeHidden();
    await expect
      .poll(() => logs.filter((line) => line.includes('onUpgradeCue card')).slice(-2))
      .toEqual(['[ui] onUpgradeCue cardFlight 0', '[ui] onUpgradeCue cardLanded 0']);
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
