import { type Page, expect, test } from '@playwright/test';
import { PAD, collectConsoleErrors, plugFakeGamepads } from './game';

const column = (page: Page, device: string) => page.locator(`[data-device-id="${device}"]`);
const confirmCount = (page: Page, device: string) =>
  column(page, device).locator('[data-count="confirm"] output');

async function holdForFrames(page: Page, pad: number, button: number): Promise<void> {
  await page.evaluate(
    async ([index, value]) => {
      const frames = (count: number) =>
        new Promise<void>((resolve) => {
          const next = (left: number) => {
            if (left === 0) resolve();
            else
              requestAnimationFrame(() => {
                next(left - 1);
              });
          };
          next(count);
        });
      const slot = window.fakePads?.[index ?? 0];
      if (slot === undefined || slot === null) throw new Error('No fake gamepad in that slot');
      slot.buttons[value ?? 0] = 1;
      await frames(2);
      slot.buttons[value ?? 0] = 0;
      await frames(2);
    },
    [pad, button],
  );
}

test('shows one column per device and keeps their inputs apart', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await plugFakeGamepads(page, 2);
  await page.goto('dev/input.html');

  await expect(page.locator('[data-device-id]')).toHaveCount(3);
  await expect(page.locator('[data-device-id]').nth(0)).toHaveAttribute(
    'data-device-id',
    'keyboardMouse',
  );
  await expect(page.locator('[data-device-id]').nth(1)).toHaveAttribute(
    'data-device-id',
    'gamepad:0',
  );
  await expect(page.locator('#count')).toHaveText('3 périphériques');

  await holdForFrames(page, 1, PAD.A);

  await expect(confirmCount(page, 'gamepad:1')).toHaveText('1');
  await expect(confirmCount(page, 'gamepad:0')).toHaveText('0');
  await expect(confirmCount(page, 'keyboardMouse')).toHaveText('0');

  await page.keyboard.press('Enter');

  await expect(confirmCount(page, 'keyboardMouse')).toHaveText('1');
  await expect(confirmCount(page, 'gamepad:1')).toHaveText('1');
  expect(errors).toEqual([]);
});

test('vibrates the gamepad of the column that asks', async ({ page }) => {
  await plugFakeGamepads(page, 2);
  await page.goto('dev/input.html');

  await column(page, 'gamepad:1')
    .getByRole('button', { name: /Impact/ })
    .click();

  await expect
    .poll(() => page.evaluate(() => window.fakePads?.map((pad) => pad?.rumbles.length)))
    .toEqual([0, 1]);
  expect(await page.evaluate(() => window.fakePads?.[1]?.rumbles)).toEqual([[0.7, 160]]);
});

test('drops an unplugged gamepad and brings it back in the same column', async ({ page }) => {
  await plugFakeGamepads(page, 2);
  await page.goto('dev/input.html');
  await expect(page.locator('[data-device-id]')).toHaveCount(3);

  await page.evaluate(() => {
    if (window.fakePads) window.fakePads[0] = null;
  });

  await expect(page.locator('[data-device-id]')).toHaveCount(2);
  await expect(column(page, 'gamepad:0')).toHaveCount(0);
  await expect(column(page, 'gamepad:1')).toHaveCount(1);

  await page.evaluate(() => {
    if (window.fakePads) {
      window.fakePads[0] = {
        axes: [0, 0, 0, 0],
        buttons: new Array<number>(17).fill(0),
        rumbles: [],
      };
    }
  });

  await expect(page.locator('[data-device-id]')).toHaveCount(3);
  await expect(page.locator('[data-device-id]').nth(1)).toHaveAttribute(
    'data-device-id',
    'gamepad:0',
  );
});
