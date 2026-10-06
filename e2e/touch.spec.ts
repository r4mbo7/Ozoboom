import { type Page, expect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

// A phone held sideways. The bench keeps the player alive whatever the bad vibes do.
test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
test.describe.configure({ timeout: 120_000 });

type Finger = (
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  x?: number,
  y?: number,
) => Promise<void>;

// Playwright only taps: a finger that slides goes through the Chrome DevTools Protocol.
async function finger(page: Page): Promise<Finger> {
  const cdp = await page.context().newCDPSession(page);
  return async (type, x = 0, y = 0) => {
    await cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
    });
  };
}

function player(page: Page) {
  return page.evaluate(() => {
    const state = window.ozoboom?.state;
    if (state === undefined) throw new Error('No dev probe');
    const [first] = state.players;
    if (first === undefined) throw new Error('No player');
    return { x: first.x, y: first.y, traps: state.traps.map((trap) => ({ x: trap.x, y: trap.y })) };
  });
}

test('plays a game with a finger: stick, traps and pause', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  const touch = await finger(page);
  await page.goto('./?dev=bench');
  await page.getByRole('button', { name: 'Jouer', exact: true }).tap();
  const pause = page.getByRole('button', { name: 'Pause' });
  await expect(pause).toBeVisible();
  await expect(page.locator('.ui-trap__key').first()).toBeHidden();

  const start = await player(page);
  await touch('touchStart', 300, 200);
  await touch('touchMove', 340, 200);
  await touch('touchMove', 380, 200);
  await expect.poll(async () => (await player(page)).x - start.x).toBeGreaterThan(60);
  await touch('touchEnd');

  // A key hands the HUD to the keyboard: the first touch on a tile must still take it.
  await page.keyboard.press('ShiftLeft');
  await expect(page.locator('.ui-trap__key').first()).toBeVisible();
  const tile = await page.locator('.ui-trap').first().boundingBox();
  if (tile === null) throw new Error('No trap tile');
  await touch('touchStart', tile.x + tile.width / 2, tile.y + tile.height / 2);
  await touch('touchMove', tile.x, tile.y - 80);
  await touch('touchMove', 700, 180);
  await touch('touchEnd');
  await expect.poll(async () => (await player(page)).traps.length).toBe(1);
  const placed = await player(page);
  const [trap] = placed.traps;
  expect(
    Math.hypot((trap?.x ?? placed.x) - placed.x, (trap?.y ?? placed.y) - placed.y),
  ).toBeGreaterThan(100);

  await pause.tap();
  await expect(page.getByRole('dialog', { name: 'Pause' })).toBeVisible();
  await page.getByRole('button', { name: 'Reprendre' }).tap();
  await expect(page.getByRole('dialog', { name: 'Pause' })).toBeHidden();
  expect(errors).toEqual([]);
});
