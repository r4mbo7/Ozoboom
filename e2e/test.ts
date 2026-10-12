import { type BrowserContext, test as base } from '@playwright/test';

export * from '@playwright/test';

// Headless Chromium reads the controllers plugged into the host: one touched mid-test takes the
// menus and the HUD. A fake gamepad of `game.ts` stays plugged, whichever init script runs first.
export async function unplugHostGamepads(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    if (window.fakePad === undefined && window.fakePads === undefined) {
      navigator.getGamepads = () => [];
    }
  });
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await unplugHostGamepads(context);
    await use(context);
  },
});
