import { type Locator, type Page, expect as baseExpect, test } from '@playwright/test';
import {
  PAD,
  collectConsoleErrors,
  plugFakeGamepad,
  repeatUntil,
  tapButton,
  tapButtonUntil,
} from './game';

// The prompts under each menu follow its layout: cards side by side or stacked, one line of
// prompts or one aligned row per action, as the screen allows.
test.describe.configure({ timeout: 120_000 });
const expect = baseExpect.configure({ timeout: 30_000 });

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

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

async function startGame(page: Page, device: 'keyboard' | 'gamepad'): Promise<void> {
  const traps = page.getByRole('region', { name: 'Pièges' });
  if (device === 'gamepad') {
    await plugFakeGamepad(page);
    await page.goto('./?dev=fast');
    await tapButtonUntil(page, PAD.A, () => traps.isVisible());
  } else {
    await page.goto('./?dev=fast');
    await page.getByRole('button', { name: 'Jouer' }).click();
    await page.mouse.move(1, 1);
    await expect(traps).toBeVisible();
  }
}

async function openUpgrade(page: Page): Promise<Locator> {
  await page.evaluate(() => {
    const player = window.ozoboom?.state.players[0];
    if (player === undefined) {
      throw new Error('The game state is not exposed');
    }
    player.vibes = player.vibesToNextLevel;
  });
  const upgrade = page.getByRole('region', { name: 'Choix d’amélioration' });
  await expect(upgrade).toBeVisible();
  await expect(upgrade.getByRole('button')).toHaveCount(3);
  return upgrade;
}

async function box(
  item: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const found = await item.boundingBox();
  if (found === null) {
    throw new Error('The element is not on screen');
  }
  return found;
}

function visibleKeys(hint: Locator): Promise<string[]> {
  return hint.locator('kbd').filter({ visible: true }).allTextContents();
}

function selected(card: Locator): Promise<boolean> {
  return card.evaluate((node) => node.getAttribute('aria-current') === 'true');
}

interface HintRow {
  label: { left: number; top: number; right: number };
  keys: { left: number; right: number };
}

// One entry per action shown: where the text of its label sits, and where its keys start and end.
function hintRows(hint: Locator): Promise<HintRow[]> {
  return hint.evaluate((node) =>
    [...node.children].flatMap((part) => {
      const label = part.lastElementChild;
      const keys = [...part.querySelectorAll('kbd')].map((key) => key.getBoundingClientRect());
      if (label === null || !label.checkVisibility() || keys.length === 0) {
        return [];
      }
      const range = document.createRange();
      range.selectNodeContents(label);
      const text = range.getBoundingClientRect();
      return [
        {
          label: { left: text.left, top: text.top, right: text.right },
          keys: {
            left: Math.min(...keys.map((key) => key.left)),
            right: Math.max(...keys.map((key) => key.right)),
          },
        },
      ];
    }),
  );
}

async function expectAlignedRows(hint: Locator, width: number, count: number): Promise<void> {
  const rows = await hintRows(hint);
  expect(rows).toHaveLength(count);
  const [first] = rows;
  for (const [index, row] of rows.entries()) {
    expect(Math.abs(row.label.left - (first?.label.left ?? 0))).toBeLessThan(0.5);
    expect(row.keys.right).toBeLessThan(row.label.left);
    expect(row.keys.left).toBeGreaterThanOrEqual(0);
    expect(row.label.right).toBeLessThanOrEqual(width);
    if (index > 0) {
      expect(row.label.top).toBeGreaterThan(rows[index - 1]?.label.top ?? 0);
    }
  }
}

async function expectOneLine(hint: Locator, count: number): Promise<void> {
  const rows = await hintRows(hint);
  expect(rows).toHaveLength(count);
  const tops = new Set(rows.map((row) => Math.round(row.label.top)));
  expect(tops.size).toBe(1);
}

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the stacked cards prompt up and down, which change the card at the keyboard', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await startGame(page, 'keyboard');

    const upgrade = await openUpgrade(page);

    const cards = upgrade.getByRole('button');
    const [first, second, third] = await Promise.all([0, 1, 2].map((n) => box(cards.nth(n))));
    expect(second?.x).toBe(first?.x);
    expect(second?.y).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0));
    expect(third?.y).toBeGreaterThan((second?.y ?? 0) + (second?.height ?? 0));
    const hint = upgrade.locator('.ui-hint');
    expect(await visibleKeys(hint)).toEqual(['↑', '↓', 'Entrée']);
    await expectAlignedRows(hint, PHONE.width, 2);
    await expect(cards.first()).toHaveAttribute('aria-current', 'true');
    await repeatUntil(
      () => press(page, 'ArrowDown'),
      () => selected(cards.nth(1)),
    );
    await press(page, 'ArrowDown');
    await expect(cards.nth(2)).toHaveAttribute('aria-current', 'true');
    await press(page, 'ArrowUp');
    await expect(cards.nth(1)).toHaveAttribute('aria-current', 'true');
    await press(page, 'ArrowUp');
    await expect(cards.first()).toHaveAttribute('aria-current', 'true');
    expect(errors).toEqual([]);
  });

  test('the stacked cards change with up and down on the directional pad', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await startGame(page, 'gamepad');

    const upgrade = await openUpgrade(page);

    const cards = upgrade.getByRole('button');
    const hint = upgrade.locator('.ui-hint');
    expect(await visibleKeys(hint)).toEqual(['Stick gauche', 'Croix', 'A']);
    await expectAlignedRows(hint, PHONE.width, 2);
    await expect(cards.first()).toHaveAttribute('aria-current', 'true');
    await tapButtonUntil(page, PAD.DpadDown, () => selected(cards.nth(1)));
    await tapButton(page, PAD.DpadDown);
    await expect(cards.nth(2)).toHaveAttribute('aria-current', 'true');
    await tapButton(page, PAD.DpadUp);
    await expect(cards.nth(1)).toHaveAttribute('aria-current', 'true');
    await tapButton(page, PAD.DpadUp);
    await expect(cards.first()).toHaveAttribute('aria-current', 'true');
    expect(errors).toEqual([]);
  });

  for (const device of ['keyboard', 'gamepad'] as const) {
    test(`the pause prompts at the ${device} stand in aligned rows within the screen`, async ({
      page,
    }) => {
      const errors = collectConsoleErrors(page);
      await startGame(page, device);
      const pause = page.getByRole('dialog', { name: 'Pause' });

      if (device === 'gamepad') {
        await tapButtonUntil(page, PAD.Start, () => pause.isVisible());
      } else {
        await press(page, 'Escape');
      }

      await expect(pause).toBeVisible();
      await expect(pause.locator('.ui-hint')).toContainText(
        device === 'gamepad' ? 'Stick gauche' : 'Entrée',
      );
      await expectAlignedRows(pause.locator('.ui-hint'), PHONE.width, 3);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('on a desktop screen', () => {
  test.use({ viewport: DESKTOP });

  test('the cards side by side prompt left and right, on one line', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await startGame(page, 'keyboard');

    const upgrade = await openUpgrade(page);

    const cards = upgrade.getByRole('button');
    const [first, second] = await Promise.all([0, 1].map((n) => box(cards.nth(n))));
    expect(second?.x).toBeGreaterThan((first?.x ?? 0) + (first?.width ?? 0));
    const hint = upgrade.locator('.ui-hint');
    expect(await visibleKeys(hint)).toEqual(['←', '→', 'Entrée']);
    await expectOneLine(hint, 2);
    expect(errors).toEqual([]);
  });

  test('the pause prompts at the gamepad hold on one line', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await startGame(page, 'gamepad');
    const pause = page.getByRole('dialog', { name: 'Pause' });

    await tapButtonUntil(page, PAD.Start, () => pause.isVisible());

    await expect(pause.locator('.ui-hint')).toContainText('Stick gauche');
    await expectOneLine(pause.locator('.ui-hint'), 3);
    expect(errors).toEqual([]);
  });
});
