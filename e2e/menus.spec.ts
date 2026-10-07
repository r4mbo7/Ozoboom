import { type Locator, type Page, expect as baseExpect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

// A menu that opens under a resting cursor gets a synthetic hover from the browser: it must keep
// its default selection until the mouse really moves.
test.describe.configure({ timeout: 120_000 });
const expect = baseExpect.configure({ timeout: 30_000 });

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

async function centerOf(item: Locator): Promise<{ x: number; y: number }> {
  const box = await item.boundingBox();
  if (box === null) {
    throw new Error('The menu item is not on screen');
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

function hovered(item: Locator): Promise<boolean> {
  return item.evaluate((node) => node.matches(':hover'));
}

// The menu has just opened under the cursor, which rests on `under`.
async function expectRestingCursorIgnored(
  page: Page,
  selected: Locator,
  under: Locator,
): Promise<void> {
  await expect.poll(() => hovered(under)).toBe(true);
  await frames(page);
  await expect(selected).toHaveAttribute('aria-current', 'true');
  await expect(under).not.toHaveAttribute('aria-current', 'true');

  const { x, y } = await centerOf(under);
  await page.mouse.move(x + 4, y + 2);
  await expect(under).toHaveAttribute('aria-current', 'true');
  await expect(selected).not.toHaveAttribute('aria-current', 'true');
}

async function startGame(page: Page): Promise<void> {
  await page.goto('./?dev=fast');
  await page.getByRole('button', { name: 'Jouer', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
}

// The scene goes silent until the game is lost: once is not enough, it may repair itself before
// the sim checks the status.
async function loseGame(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const silence = () => {
          const state = window.ozoboom?.state;
          if (state === undefined) {
            reject(new Error('The game state is not exposed'));
          } else if (state.status === 'lost') {
            resolve();
          } else {
            state.core.hp = 0;
            requestAnimationFrame(silence);
          }
        };
        silence();
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

test('the title shows again under a resting cursor without moving the selection', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await page.goto('./');
  const feedback = page.getByRole('button', { name: /^Ton avis/ });
  const sound = page.getByRole('slider', { name: 'Son' });
  for (let index = 0; index < 7; index++) {
    await page.keyboard.press('ArrowDown');
    await frames(page);
  }
  await expect(feedback).toHaveAttribute('aria-current', 'true');
  const spot = await centerOf(sound);
  await page.keyboard.press('Enter');
  const form = page.getByRole('dialog', { name: 'Raconte-nous ta soirée' });
  await expect(form).toBeVisible();
  await page.mouse.move(spot.x, spot.y);

  await page.keyboard.press('Escape');

  await expect(form).toBeHidden();
  await expectRestingCursorIgnored(page, feedback, sound);
  expect(errors).toEqual([]);
});

test('the pause opens under a resting cursor without moving the selection', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await startGame(page);
  const pause = page.getByRole('dialog', { name: 'Pause' });
  const resume = pause.getByRole('button', { name: 'Reprendre' });
  const feedback = pause.getByRole('button', { name: /^Ton avis/ });
  await page.keyboard.press('Escape');
  await expect(pause).toBeVisible();
  const spot = await centerOf(feedback);
  await page.keyboard.press('Escape');
  await expect(pause).toBeHidden();
  await page.mouse.move(spot.x, spot.y);

  await page.keyboard.press('Escape');

  await expect(pause).toBeVisible();
  await expectRestingCursorIgnored(page, resume, feedback);
  expect(errors).toEqual([]);
});

test('the upgrade choice opens under a resting cursor without moving the selection', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await startGame(page);
  const upgrade = page.getByRole('region', { name: 'Choix d’amélioration' });
  const cards = upgrade.getByRole('button');
  await levelUp(page);
  await expect(upgrade).toBeVisible();
  await expect(cards).toHaveCount(3);
  await cards.nth(2).click();
  await expect(upgrade).toBeHidden();

  await levelUp(page);

  await expect(upgrade).toBeVisible();
  await expect(upgrade.getByText('Niveau 3')).toBeVisible();
  await expectRestingCursorIgnored(page, cards.first(), cards.nth(2));
  expect(errors).toEqual([]);
});

test('the end screen opens under a resting cursor without moving the selection', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await startGame(page);
  const end = page.getByRole('region', { name: 'Fin de partie' });
  const restart = end.getByRole('button', { name: 'Rejouer' });
  const feedback = end.getByRole('button', { name: /^Ton avis/ });
  await loseGame(page);
  await expect(end).toBeVisible();
  const spot = await centerOf(feedback);
  await restart.click();
  await expect(end).toBeHidden();
  await page.mouse.move(spot.x, spot.y);

  await loseGame(page);

  await expect(end).toBeVisible();
  await expectRestingCursorIgnored(page, restart, feedback);
  expect(errors).toEqual([]);
});
