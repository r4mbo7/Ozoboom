import { expect, test } from '@playwright/test';

interface Icon {
  src: string;
  sizes: string;
}

test('installs to the home screen and opens without the browser bars', async ({ page }) => {
  await page.goto('./');
  const cdp = await page.context().newCDPSession(page);

  const { url, errors, data } = await cdp.send('Page.getAppManifest');

  expect(url, 'manifest link').not.toBe('');
  expect(errors).toEqual([]);
  const manifest = JSON.parse(data ?? '{}') as { display: string; icons: Icon[] };
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(
    expect.arrayContaining(['192x192', '512x512']),
  );
  for (const icon of manifest.icons) {
    const size = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return `${String(image.naturalWidth)}x${String(image.naturalHeight)}`;
    }, new URL(icon.src, url).href);
    expect(size, icon.src).toBe(icon.sizes);
  }
});
