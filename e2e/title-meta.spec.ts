import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

test('the title shows the release number', async ({ page }) => {
  await page.goto('./');

  await expect(page.locator('.ui-title__meta')).toHaveText(`v${version.replace(/\.0$/, '')}`);
});
