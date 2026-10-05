import { type Locator, type Page, expect as baseExpect, test } from '@playwright/test';
import { PAD, collectConsoleErrors, plugFakeGamepad, tapButtonUntil, tiltLeftStick } from './game';

// A direction held in combat, to move, must not walk a menu that opens under it: the menu waits
// for its release.
test.describe.configure({ timeout: 120_000 });
const expect = baseExpect.configure({ timeout: 30_000 });

async function frames(page: Page, count = 2): Promise<void> {
  await page.evaluate(
    (left) =>
      new Promise<void>((resolve) => {
        const next = (remaining: number) => {
          if (remaining === 0) {
            resolve();
          } else {
            requestAnimationFrame(() => {
              next(remaining - 1);
            });
          }
        };
        next(left);
      }),
    count,
  );
}

// Proving that a held direction does nothing takes time: the menu ignores everything for 500 ms
// after it opens, then a held direction repeats after 400 ms and every 120 ms. This watches the
// menu over the game's own clock past all of it, and over enough frames that a slow machine polls
// the input as many times as a fast one would, and counts every move of its selection.
function selectionMovesWhileHeld(menu: Locator): Promise<number> {
  return menu.evaluate(
    (node) =>
      new Promise<number>((resolve) => {
        let moves = 0;
        const observer = new MutationObserver((records) => {
          moves += records.filter(
            (record) =>
              record.target instanceof Element &&
              record.target.getAttribute('aria-current') === 'true',
          ).length;
        });
        observer.observe(node, {
          attributes: true,
          attributeFilter: ['aria-current'],
          subtree: true,
        });
        const start = performance.now();
        let seen = 0;
        const next = () => {
          seen += 1;
          if (seen >= 30 && performance.now() - start >= 1500) {
            observer.disconnect();
            resolve(moves);
          } else {
            requestAnimationFrame(next);
          }
        };
        requestAnimationFrame(next);
      }),
  );
}

async function levelUp(page: Page): Promise<void> {
  await page.evaluate(() => {
    const player = window.ozoboom?.state.players[0];
    if (player === undefined) {
      throw new Error('The game state is not exposed');
    }
    player.vibes = player.vibesToNextLevel;
  });
}

async function setLeftStick(page: Page, x: number): Promise<void> {
  await page.evaluate((value) => {
    const pad = window.fakePad;
    if (pad === undefined) {
      throw new Error('No fake gamepad plugged');
    }
    pad.axes[0] = value;
  }, x);
}

test('a left stick held at a level up leaves the first card selected until it comes back', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await plugFakeGamepad(page);
  await page.goto('./?dev=fast');
  const traps = page.getByRole('region', { name: 'Pièges' });
  await tapButtonUntil(page, PAD.A, () => traps.isVisible());
  const upgrade = page.getByRole('region', { name: 'Choix d’amélioration' });
  const cards = upgrade.getByRole('button');
  await setLeftStick(page, 1);
  await frames(page);

  await levelUp(page);

  await expect(upgrade).toBeVisible();
  expect(await selectionMovesWhileHeld(upgrade)).toBe(0);
  await expect(cards.first()).toHaveAttribute('aria-current', 'true');
  await setLeftStick(page, 0);
  await frames(page);
  await expect(cards.first()).toHaveAttribute('aria-current', 'true');
  await tiltLeftStick(page, 1, 0);
  await expect(cards.nth(1)).toHaveAttribute('aria-current', 'true');
  await frames(page);
  await expect(cards.nth(1)).toHaveAttribute('aria-current', 'true');
  expect(errors).toEqual([]);
});

test('an arrow key held at a level up leaves the first card selected until it is released', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto('./?dev=fast');
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  const upgrade = page.getByRole('region', { name: 'Choix d’amélioration' });
  const cards = upgrade.getByRole('button');
  await page.keyboard.down('ArrowRight');
  await frames(page);

  await levelUp(page);

  await expect(upgrade).toBeVisible();
  expect(await selectionMovesWhileHeld(upgrade)).toBe(0);
  await expect(cards.first()).toHaveAttribute('aria-current', 'true');
  await page.keyboard.up('ArrowRight');
  await frames(page);
  await expect(cards.first()).toHaveAttribute('aria-current', 'true');
  await page.keyboard.press('ArrowRight');
  await expect(cards.nth(1)).toHaveAttribute('aria-current', 'true');
  await frames(page);
  await expect(cards.nth(1)).toHaveAttribute('aria-current', 'true');
  expect(errors).toEqual([]);
});

test('a key held when the game is lost leaves « Rejouer » selected until it is released', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto('./?dev=fast');
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  const end = page.getByRole('region', { name: 'Fin de partie' });
  const restart = end.getByRole('button', { name: 'Rejouer' });
  const feedback = end.getByRole('button', { name: /^Ton avis/ });
  await page.keyboard.down('KeyS');
  await frames(page);

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const down = () => {
          const state = window.ozoboom?.state;
          if (state === undefined) {
            reject(new Error('The game state is not exposed'));
          } else if (state.status === 'lost') {
            resolve();
          } else {
            state.players.forEach((player) => {
              player.downed = true;
            });
            requestAnimationFrame(down);
          }
        };
        down();
      }),
  );

  await expect(end).toBeVisible();
  expect(await selectionMovesWhileHeld(end)).toBe(0);
  await expect(restart).toHaveAttribute('aria-current', 'true');
  await page.keyboard.up('KeyS');
  await frames(page);
  await page.keyboard.press('KeyS');
  await expect(feedback).toHaveAttribute('aria-current', 'true');
  expect(errors).toEqual([]);
});
