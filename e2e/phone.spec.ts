import { type Locator, expect, test } from '@playwright/test';

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

  test('shows every class name whole on the title', async ({ page }) => {
    await page.goto('./?dev=fast');
    await expectWholeIn(page.locator('.ui-class__name'), '.ui-class');
  });
});

test.describe('a phone held sideways', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('keeps the skill name and its state inside the action bar', async ({ page }) => {
    await page.goto('./?dev=bench');
    await page.getByRole('radio', { name: 'Le roadie' }).tap();
    await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
    await expect(page.locator('.ui-skill__status')).toHaveText('Prête');
    await expectWholeIn(page.locator('.ui-skill__name, .ui-skill__status'), '.ui-hud__bar');
  });
});
