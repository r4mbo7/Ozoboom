import { type Page, expect, test } from './test';
import {
  PAD,
  PAD_SEED,
  collectConsoleErrors,
  playWithPad,
  plugFakeGamepad,
  readGame,
  tapButtonUntil,
} from './game';

// Full games on the short set of `?dev=fast` (src/app/dev.ts): title, traps, an upgrade, the end
// and a restart, once with the keyboard only and once with a gamepad only.
test.describe.configure({ timeout: 180_000 });

const MOVE_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' } as const;

async function holdKeys(page: Page, held: Set<string>, wanted: ReadonlySet<string>) {
  for (const key of held) {
    if (!wanted.has(key)) {
      await page.keyboard.up(key);
      held.delete(key);
    }
  }
  for (const key of wanted) {
    if (!held.has(key)) {
      await page.keyboard.down(key);
      held.add(key);
    }
  }
}

test('plays a whole game with the keyboard only, from the title to a restart', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('./?dev=fast');
  await expect(page.getByRole('button', { name: 'Jouer', exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Choix du perso' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();

  await page.keyboard.press('KeyF');
  await expect(page.locator('.ui-trap[data-empty]')).toHaveCount(2);

  // Without a pointer, the keyboard aims where the player moves: walk at the nearest bad vibe and
  // fire until the first level, then stand still and let the bad vibes win.
  const held = new Set<string>();
  const upgrade = page.getByRole('region', { name: 'Choix d’amélioration' });
  const cards = upgrade.getByRole('button');
  let navigated = false;

  // An offer ignores the keys pressed while it opens, and a boss relic can follow a level on the
  // very next frame: press until the choice counts, then look again for the next offer.
  async function chooseOffers() {
    await holdKeys(page, held, new Set());
    while ((await readGame(page))?.status === 'choosingUpgrade') {
      await expect(upgrade).toBeVisible();
      if (!navigated) {
        navigated = true;
        await expect
          .poll(async () => {
            await page.keyboard.press('ArrowRight');
            return cards.first().getAttribute('aria-current');
          })
          .toBeNull();
      }
      const before = (await readGame(page))?.choices ?? 0;
      await expect
        .poll(async () => {
          await page.keyboard.press('Enter');
          return (await readGame(page))?.choices ?? 0;
        })
        .toBeGreaterThan(before);
    }
  }

  for (;;) {
    const game = await readGame(page);
    if (game === null) {
      throw new Error('The game state is not exposed');
    }
    if (game.status === 'choosingUpgrade') {
      await chooseOffers();
      await expect(page.getByRole('region', { name: 'Niveau' })).toContainText('2');
      break;
    }
    const nearest = game.enemies.reduce<{ x: number; y: number } | null>(
      (best, enemy) =>
        best === null ||
        Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y) <
          Math.hypot(best.x - game.player.x, best.y - game.player.y)
          ? enemy
          : best,
      null,
    );
    const wanted = new Set<string>(nearest === null ? [] : ['Space']);
    if (nearest !== null) {
      const dx = nearest.x - game.player.x;
      const dy = nearest.y - game.player.y;
      const slack = 0.4 * Math.max(Math.abs(dx), Math.abs(dy));
      if (dx > slack) wanted.add(MOVE_KEYS.right);
      if (dx < -slack) wanted.add(MOVE_KEYS.left);
      if (dy > slack) wanted.add(MOVE_KEYS.down);
      if (dy < -slack) wanted.add(MOVE_KEYS.up);
    }
    await holdKeys(page, held, wanted);
  }

  // The boss drops a relic on the way to the end: it needs a choice too.
  const end = page.getByRole('region', { name: 'Fin de partie' });
  for (;;) {
    await expect
      .poll(async () => (await readGame(page))?.status, { timeout: 120_000 })
      .not.toBe('running');
    const status = (await readGame(page))?.status;
    if (status === 'choosingUpgrade') {
      await chooseOffers();
    } else {
      break;
    }
  }
  await expect(end).toBeVisible();
  // The seed and the timing decide the outcome: the sunrise comes if the scene holds, otherwise the
  // scene or the player falls first. The end tells which one happened.
  const result = await page.evaluate(() => ({
    status: window.ozoboom?.state.status,
    silent: (window.ozoboom?.state.core.hp ?? 0) <= 0,
    classId: window.ozoboom?.state.players[0]?.classId,
  }));
  expect(result.classId).toBe('mage');
  const title =
    result.status === 'won'
      ? 'Sunrise'
      : result.silent
        ? 'La musique s’arrête'
        : 'Plus personne debout';
  await expect(end).toContainText(title);
  await expect
    .poll(async () => {
      await page.keyboard.press('Enter');
      return end.isHidden();
    })
    .toBe(true);
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  await expect(page.locator('.ui-trap[data-empty]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('plays a whole game with a gamepad only, to the sunrise and a restart', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await plugFakeGamepad(page);
  await page.goto(`./?dev=fast&seed=${String(PAD_SEED)}`);
  const hud = page.getByRole('region', { name: 'Pièges' });
  const pause = page.getByRole('dialog', { name: 'Pause' });

  const { status, upgrades } = await playWithPad(page, async () => {
    await tapButtonUntil(page, PAD.A, () => hud.isVisible());
    await tapButtonUntil(page, PAD.Start, () => pause.isVisible());
    await tapButtonUntil(page, PAD.Start, () => pause.isHidden());
  });
  const end = page.getByRole('region', { name: 'Fin de partie' });
  expect(status).toBe('won');
  await expect(end).toBeVisible();
  await expect(end).toContainText('Sunrise');
  expect(upgrades).toBeGreaterThan(0);
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeHidden();
  await tapButtonUntil(page, PAD.A, () => end.isHidden());
  await expect(page.locator('.ui-trap[data-empty]')).toHaveCount(1);
  expect(errors).toEqual([]);
});
