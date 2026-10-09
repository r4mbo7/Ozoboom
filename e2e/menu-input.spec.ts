import { type Page, expect as baseExpect, test } from '@playwright/test';
import {
  PAD,
  collectConsoleErrors,
  plugFakeGamepad,
  repeatUntil,
  tapButtonUntil,
  tiltLeftStick,
} from './game';

test.describe.configure({ timeout: 120_000 });
const expect = baseExpect.configure({ timeout: 30_000 });

// Menus read the input once per frame: two frames after a release, any effect has happened.
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
  await page.keyboard.down(key);
  await frames(page);
  await page.keyboard.up(key);
  await frames(page);
}

// Everything a key could change in a menu: what is shown and selected, the switches, what holds the
// browser focus or shows its ring, and the game below.
async function look(page: Page) {
  return page.evaluate(() => {
    const visible = (selector: string) =>
      [...document.querySelectorAll(selector)].filter((node) => node.checkVisibility());
    const name = (node: Element) =>
      (node.getAttribute('aria-label') ?? node.textContent).trim().slice(0, 30);
    const state = window.ozoboom?.state;
    const focused = document.activeElement;
    return {
      screens: visible('.ui-screen').map(name),
      selected: visible('[aria-current]').map(name),
      checked: visible('[aria-checked]').map((node) => node.getAttribute('aria-checked')),
      focusedButton: focused instanceof HTMLButtonElement ? name(focused) : null,
      ringed: visible(':focus-visible').map(name),
      status: state?.status,
      upgrades: state?.players[0]?.upgrades.length,
      weapons: state?.players[0]?.weapons?.map((slot) => `${slot.id}:${String(slot.level)}`),
      tick: state?.status === 'running' ? state.tick : null,
    };
  });
}

async function expectSpaceIgnored(page: Page): Promise<void> {
  const before = await look(page);
  await press(page, 'Space');
  expect(await look(page)).toEqual(before);
  expect(before.focusedButton).toBeNull();
}

// A click leaves the cursor on the button: move it away, so that only the keys act on the menus.
async function clickAndLeave(page: Page, target: ReturnType<Page['getByRole']>): Promise<void> {
  await target.click();
  await page.mouse.move(1, 1);
}

test('Space does nothing in any menu, even after a click on a button', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('./?dev=fast');
  const calm = page.getByRole('switch', { name: /^Mode calme/ });
  await expect(calm).toBeVisible();
  await frames(page);
  await expectSpaceIgnored(page);
  await clickAndLeave(page, calm);
  await expect(calm).toHaveAttribute('aria-checked', 'true');
  await expectSpaceIgnored(page);

  await clickAndLeave(page, page.getByRole('button', { name: 'Jouer', exact: true }));
  await expect(page.getByRole('region', { name: 'Pièges' })).toBeVisible();
  await press(page, 'Escape');
  const pause = page.getByRole('dialog', { name: 'Pause' });
  await expect(pause).toBeVisible();
  await expectSpaceIgnored(page);

  await clickAndLeave(page, pause.getByRole('button', { name: /^Ton avis/ }));
  const form = page.getByRole('dialog', { name: 'Raconte-nous ta soirée' });
  await expect(form).toBeVisible();
  await frames(page);
  await expectSpaceIgnored(page);
  const attach = form.getByRole('switch', { name: /^Joindre le contexte/ });
  await clickAndLeave(page, attach);
  await expect(attach).toHaveAttribute('aria-checked', 'false');
  await expectSpaceIgnored(page);
  const field = form.getByRole('textbox', { name: 'Ton avis' });
  await clickAndLeave(page, field);
  await page.keyboard.type('deux mots');
  await expect(field).toHaveValue('deux mots');
  await press(page, 'Escape');
  await expect(field).not.toBeFocused();
  await press(page, 'Escape');
  await expect(form).toBeHidden();
  await expectSpaceIgnored(page);
  await press(page, 'Escape');
  await expect(pause).toBeHidden();

  await page.evaluate(() => {
    const player = window.ozoboom?.state.players[0];
    if (player === undefined) {
      throw new Error('The game state is not exposed');
    }
    player.vibes = player.vibesToNextLevel;
  });
  const upgrade = page.getByRole('region', { name: 'Choix d’amélioration' });
  const firstCard = upgrade.getByRole('button').first();
  await expect(firstCard).toHaveAttribute('aria-current', 'true');
  await repeatUntil(
    () => press(page, 'ArrowRight'),
    async () => (await firstCard.getAttribute('aria-current')) === null,
  );
  await expectSpaceIgnored(page);
  await press(page, 'Enter');
  await expect(upgrade).toBeHidden();

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
  const end = page.getByRole('region', { name: 'Fin de partie' });
  await expect(end).toBeVisible();
  const feedback = end.getByRole('button', { name: /^Ton avis/ });
  await repeatUntil(
    () => press(page, 'ArrowDown'),
    async () => (await feedback.getAttribute('aria-current')) === 'true',
  );
  await expectSpaceIgnored(page);
  await clickAndLeave(page, feedback);
  await expect(form).toBeVisible();
  await press(page, 'Escape');
  await expect(form).toBeHidden();
  await expectSpaceIgnored(page);
  await expect(end).toBeVisible();
  expect(errors).toEqual([]);
});

test('the left stick alone walks through a menu, and still moves the player in game', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);
  await plugFakeGamepad(page);
  await page.goto('./?dev=fast');
  const play = page.getByRole('button', { name: 'Jouer', exact: true });
  const sound = page.getByRole('slider', { name: 'Son' });
  await expect(play).toHaveAttribute('aria-current', 'true');

  await repeatUntil(
    () => tiltLeftStick(page, 0.1, 0.9),
    async () => (await sound.getAttribute('aria-current')) === 'true',
  );
  await expect(page.locator('.ui-title .ui-hint')).toContainText('Stick gauche');
  await tapButtonUntil(
    page,
    PAD.A,
    async () => (await sound.getAttribute('aria-valuetext')) === 'Coupé',
  );
  await repeatUntil(
    () => tiltLeftStick(page, 0.2, -0.9),
    async () => (await play.getAttribute('aria-current')) === 'true',
  );
  await tapButtonUntil(page, PAD.A, () => page.getByRole('region', { name: 'Pièges' }).isVisible());

  const playerX = () => page.evaluate(() => window.ozoboom?.state.players[0]?.x ?? 0);
  const start = await playerX();
  await page.evaluate(() => {
    if (window.fakePad !== undefined) {
      window.fakePad.axes[0] = 1;
    }
  });
  await expect.poll(playerX).toBeGreaterThan(start + 50);
  expect(errors).toEqual([]);
});
