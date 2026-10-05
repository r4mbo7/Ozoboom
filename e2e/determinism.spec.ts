import { expect, test } from '@playwright/test';
import { REPLAY_SCRIPTS } from '../src/sim/replay-scripts';

test('every scripted game ends on the fingerprint Vitest pins in Node', async ({ page }) => {
  await page.goto('dev/replay.html');
  await page.waitForFunction(() => window.ozoboomReplay !== undefined, undefined, {
    timeout: 90_000,
  });

  const hashes = await page.evaluate(() => window.ozoboomReplay);

  expect(hashes).toEqual(Object.fromEntries(REPLAY_SCRIPTS.map(({ id, hash }) => [id, hash])));
});
