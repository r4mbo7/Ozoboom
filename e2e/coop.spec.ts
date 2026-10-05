import { type Page, expect as baseExpect, test } from '@playwright/test';
import { PAD, collectConsoleErrors, plugFakeGamepads, repeatUntil } from './game';

// A local game of two on the short set of `?dev=fast`: the keyboard and a gamepad each take a seat
// in the lobby, play on one screen, pick their cards side by side and reach the team end.
test.describe.configure({ timeout: 300_000 });
const expect = baseExpect.configure({ timeout: 30_000 });

// The game reads each device once per frame: let two frames go by, so that what a gesture did is
// on the page when it is looked at.
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

async function pressKey(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
  await frames(page);
  await page.keyboard.up(key);
  await frames(page);
}

async function tapPad(page: Page, button: number): Promise<void> {
  await page.evaluate((index) => {
    const pad = window.fakePads?.[0];
    if (pad === undefined || pad === null) {
      throw new Error('No fake gamepad plugged');
    }
    pad.buttons[index] = 1;
  }, button);
  await frames(page);
  await page.evaluate((index) => {
    const pad = window.fakePads?.[0];
    if (pad !== undefined && pad !== null) {
      pad.buttons[index] = 0;
    }
  }, button);
  await frames(page);
}

// Two players in the page, each on their own device: the keyboard through key events, the gamepad
// through its sticks. Both go for the nearest vibe, else walk at the nearest bad vibe, and fire.
async function startBots(page: Page): Promise<void> {
  await page.evaluate(() => {
    const held = new Set<string>();
    const hold = (code: string, on: boolean) => {
      if (held.has(code) === on) return;
      if (on) held.add(code);
      else held.delete(code);
      window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code }));
    };
    const play = () => {
      const state = window.ozoboom?.state;
      const pad = window.fakePads?.[0];
      if (state === undefined || pad === undefined || pad === null) return;
      const running = state.status === 'running';
      const goalOf = (id: number) => {
        const player = state.players.find((candidate) => candidate.id === id);
        if (player === undefined || player.downed) return null;
        const distance = (x: number, y: number) => Math.hypot(x - player.x, y - player.y);
        const nearest = [...state.enemies].sort(
          (a, b) => distance(a.x, a.y) - distance(b.x, b.y),
        )[0];
        const pickup = state.pickups
          .filter((candidate) => distance(candidate.x, candidate.y) < 350)
          .sort((a, b) => distance(a.x, a.y) - distance(b.x, b.y))[0];
        const goal = pickup ?? nearest ?? { x: state.core.x - 100, y: state.core.y };
        return { player, nearest, goal, distance };
      };
      const first = running ? goalOf(0) : null;
      const slack = (value: number, other: number) =>
        0.4 * Math.max(Math.abs(value), Math.abs(other));
      const dx = first === null ? 0 : first.goal.x - first.player.x;
      const dy = first === null ? 0 : first.goal.y - first.player.y;
      hold('KeyD', dx > slack(dx, dy));
      hold('KeyA', dx < -slack(dx, dy));
      hold('KeyS', dy > slack(dx, dy));
      hold('KeyW', dy < -slack(dx, dy));
      hold('Space', first?.nearest !== undefined);

      const second = running ? goalOf(1) : null;
      const toGoal = second === null ? 0 : second.distance(second.goal.x, second.goal.y);
      const toNearest =
        second?.nearest === undefined ? 0 : second.distance(second.nearest.x, second.nearest.y);
      pad.axes = [
        second !== null && toGoal > 20 ? (second.goal.x - second.player.x) / toGoal : 0,
        second !== null && toGoal > 20 ? (second.goal.y - second.player.y) / toGoal : 0,
        second?.nearest === undefined || toNearest === 0
          ? 0
          : (second.nearest.x - second.player.x) / toNearest,
        second?.nearest === undefined || toNearest === 0
          ? 0
          : (second.nearest.y - second.player.y) / toNearest,
      ];
      // The right trigger of the standard mapping.
      pad.buttons[7] = second?.nearest === undefined ? 0 : 1;
      if (state.status !== 'won' && state.status !== 'lost') {
        requestAnimationFrame(play);
      } else {
        for (const code of [...held]) hold(code, false);
        pad.axes = [0, 0, 0, 0];
        pad.buttons.fill(0);
      }
    };
    play();
  });
}

test('two players, the keyboard and a gamepad, play a whole local game side by side', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await plugFakeGamepads(page, 1);
  await page.goto('./?dev=fast');

  await page.getByRole('button', { name: 'Jouer à plusieurs' }).click();
  const lobby = page.getByRole('region', { name: 'Salon' });
  await expect(lobby.getByRole('heading', { name: 'Salon local' })).toBeVisible();
  const taken = lobby.locator('.ui-seat[data-state="taken"]');
  await expect(taken).toHaveCount(0);

  await repeatUntil(
    () => pressKey(page, 'Enter'),
    async () => (await taken.count()) === 1,
  );
  await expect(taken.first()).toContainText('Clavier et souris');
  await repeatUntil(
    () => tapPad(page, PAD.A),
    async () => (await taken.count()) === 2,
  );
  await expect(taken.nth(1)).toContainText('Manette 1');
  await expect(taken.first()).toContainText('Lance le set');

  // The gamepad moves to its class row and steps to the next class: both seats start on different
  // classes, and this one ends on a third.
  const padClass = taken.nth(1).locator('.ui-stepper');
  await repeatUntil(
    () => tapPad(page, PAD.DpadDown),
    async () => (await padClass.getAttribute('aria-current')) === 'true',
  );
  const before = await padClass.locator('.ui-stepper__name').textContent();
  await repeatUntil(
    () => tapPad(page, PAD.DpadRight),
    async () => (await padClass.locator('.ui-stepper__name').textContent()) !== before,
  );
  const names = await taken.locator('.ui-stepper__name').allTextContents();
  expect(new Set(names).size).toBe(2);
  await page.screenshot({ path: test.info().outputPath('lobby.png') });

  await lobby.getByRole('button', { name: 'Lancer le set' }).click();
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  const seats = await page.evaluate(() => window.ozoboom?.seats);
  expect(seats?.map((seat) => [seat.playerId, seat.device, seat.local])).toEqual([
    [0, 'keyboardMouse', true],
    [1, 'gamepad:0', true],
  ]);
  expect(new Set(seats?.map((seat) => seat.classId)).size).toBe(2);
  expect(await page.evaluate(() => window.ozoboom?.state.players.length)).toBe(2);

  // The pause is the team's: the gamepad pauses, the keyboard resumes.
  const pause = page.getByRole('dialog', { name: 'Pause' });
  await repeatUntil(
    () => tapPad(page, PAD.Start),
    () => pause.isVisible(),
  );
  const tick = await page.evaluate(() => window.ozoboom?.state.tick);
  await frames(page, 10);
  expect(await page.evaluate(() => window.ozoboom?.state.tick)).toBe(tick);
  await repeatUntil(
    () => pressKey(page, 'Escape'),
    () => pause.isHidden(),
  );

  await startBots(page);

  const status = () => page.evaluate(() => window.ozoboom?.state.status);
  const offerFor = (playerId: number) =>
    page.evaluate(
      (id) => window.ozoboom?.state.pendingUpgrades.some((offer) => offer.playerId === id),
      playerId,
    );
  const upgrade = page.getByRole('region', { name: 'Choix d’amélioration' });
  let sideBySide = false;

  for (;;) {
    await expect.poll(status, { timeout: 150_000 }).not.toBe('running');
    const current = await status();
    if (current === 'won' || current === 'lost') {
      break;
    }
    if (!sideBySide) {
      sideBySide = true;
      await expect(upgrade.locator('.ui-offer:visible')).toHaveCount(2);
      await page.screenshot({ path: test.info().outputPath('offers.png') });
    }
    await repeatUntil(
      () => pressKey(page, 'Enter'),
      async () => !(await offerFor(0)),
    );
    await repeatUntil(
      () => tapPad(page, PAD.A),
      async () => !(await offerFor(1)),
    );
  }
  expect(sideBySide).toBe(true);

  const end = page.getByRole('region', { name: 'Fin de partie' });
  await expect(end).toBeVisible();
  await expect(end.getByRole('list', { name: 'L’équipe' }).getByRole('listitem')).toHaveCount(2);
  await page.screenshot({ path: test.info().outputPath('end.png') });

  await repeatUntil(
    () => tapPad(page, PAD.A),
    () => end.isHidden(),
  );
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  expect(await page.evaluate(() => window.ozoboom?.seats.length)).toBe(2);
  expect(errors).toEqual([]);
});
