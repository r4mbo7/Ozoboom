import { expect, test } from '@playwright/test';
import { CLIP_CEILING } from '../src/audio/master';
import { collectConsoleErrors } from './game';

test('the four speaker layers stack on the set without clipping the master chain', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = collectConsoleErrors(page);

  await page.goto('dev/audio.html');
  await page.locator('[data-layers]').click();
  await expect(page.locator('[data-out="layers"]')).toHaveText('30 s, 18 mesures', {
    timeout: 90_000,
  });

  const peak = Number((await page.locator('[data-out="layersPeak"]').textContent())?.split(' ')[0]);
  const clipped = Number(
    (await page.locator('[data-out="layersPeak"]').textContent())?.match(/(\d+) échantillons/)?.[1],
  );
  const [allOn, bare] = (
    (await page.locator('[data-out="layersAllOn"]').textContent())?.match(/\d\.\d+/g) ?? []
  ).map(Number);
  expect(peak).toBeLessThan(CLIP_CEILING);
  expect(clipped).toBe(0);
  expect(allOn).toBeDefined();
  expect(bare).toBeDefined();
  expect(allOn ?? Infinity).toBeLessThanOrEqual((bare ?? 0) + 0.01);
  expect(errors).toEqual([]);
});
