import { type Page, expect, test } from '@playwright/test';
import { PAD, collectConsoleErrors, plugFakeGamepad, tapButtonUntil, readGame } from './game';

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
  await page.goto('./?dev=fast');
  const hud = page.getByRole('region', { name: 'Pièges' });
  await tapButtonUntil(page, PAD.A, () => hud.isVisible());

  const pause = page.getByRole('dialog', { name: 'Pause' });
  await tapButtonUntil(page, PAD.Start, () => pause.isVisible());
  await tapButtonUntil(page, PAD.Start, () => pause.isHidden());

  // A player in the page: aims the right stick at the nearest bad vibe and fires, picks up the
  // vibes and the loots, stays by the scene, places traps and novas the close ones. It counts in
  // ticks, not in milliseconds, so that a loaded machine does not change how it plays.
  await page.evaluate(() => {
    const TICKS_BETWEEN_TRAPS = 336;
    let lastTrap = -TICKS_BETWEEN_TRAPS;
    const play = () => {
      const pad = window.fakePad;
      const state = window.ozoboom?.state;
      const player = state?.players[0];
      if (pad === undefined || state === undefined || player === undefined) {
        return;
      }
      const running = state.status === 'running';
      const distance = (x: number, y: number) => Math.hypot(x - player.x, y - player.y);
      const nearest = [...state.enemies].sort((a, b) => distance(a.x, a.y) - distance(b.x, b.y))[0];
      const handFree = (player.hand?.length ?? 0) < 2;
      const pickup = [...state.pickups, ...(handFree ? (state.loots ?? []) : [])]
        .filter((candidate) => distance(candidate.x, candidate.y) < 350)
        .sort((a, b) => distance(a.x, a.y) - distance(b.x, b.y))[0];
      const goal = pickup ?? { x: state.core.x - 100, y: state.core.y };
      const toGoal = distance(goal.x, goal.y);
      pad.axes = [
        running && toGoal > 20 ? (goal.x - player.x) / toGoal : 0,
        running && toGoal > 20 ? (goal.y - player.y) / toGoal : 0,
        nearest === undefined ? 0 : (nearest.x - player.x) / distance(nearest.x, nearest.y),
        nearest === undefined ? 0 : (nearest.y - player.y) / distance(nearest.x, nearest.y),
      ];
      pad.buttons[7] = running && nearest !== undefined ? 1 : 0;
      pad.buttons[6] =
        running && state.enemies.some((enemy) => distance(enemy.x, enemy.y) < 140) ? 1 : 0;
      if (!running) {
        // The test taps A itself in the menus.
      } else if (pad.buttons[0] === 1) {
        pad.buttons[0] = 0;
      } else if ((player.hand?.length ?? 0) > 0 && state.tick - lastTrap > TICKS_BETWEEN_TRAPS) {
        pad.buttons[0] = 1;
        lastTrap = state.tick;
      }
      if (state.status !== 'won' && state.status !== 'lost') {
        requestAnimationFrame(play);
      } else {
        pad.axes = [0, 0, 0, 0];
        pad.buttons.fill(0);
      }
    };
    play();
  });

  const upgrade = page.getByRole('region', { name: 'Choix d’amélioration' });
  const end = page.getByRole('region', { name: 'Fin de partie' });
  const firstCard = upgrade.getByRole('button').first();
  let upgrades = 0;
  let status = (await readGame(page))?.status;
  while (status !== 'won' && status !== 'lost') {
    if (status === 'choosingUpgrade') {
      await expect(firstCard).toHaveAttribute('aria-current', 'true');
      await tapButtonUntil(
        page,
        PAD.DpadRight,
        async () => (await firstCard.getAttribute('aria-current')) === null,
      );
      // Two levels at once present two offers in a row: a choice shows as one more upgrade, not as a status.
      const chosen = (await readGame(page))?.choices ?? 0;
      await tapButtonUntil(
        page,
        PAD.A,
        async () => ((await readGame(page))?.choices ?? 0) > chosen,
      );
      upgrades += 1;
    }
    await expect
      .poll(async () => (await readGame(page))?.status, { timeout: 150_000 })
      .not.toBe('running');
    status = (await readGame(page))?.status;
  }

  expect(status).toBe('won');
  await expect(end).toBeVisible();
  await expect(end).toContainText('Sunrise');
  expect(upgrades).toBeGreaterThan(0);
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeHidden();
  await tapButtonUntil(page, PAD.A, () => end.isHidden());
  await expect(page.locator('.ui-trap[data-empty]')).toHaveCount(1);
  expect(errors).toEqual([]);
});
