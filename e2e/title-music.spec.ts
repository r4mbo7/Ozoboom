import { type Page, expect as baseExpect, test } from '@playwright/test';
import { collectConsoleErrors } from './game';

// SwiftShader frames are slow on CI and when tests run in parallel: 30 seconds per assertion.
const expect = baseExpect.configure({ timeout: 30_000 });

declare global {
  interface Window {
    audioProbe?: { contexts: AudioContext[]; output: GainNode | null };
  }
}

// Records the contexts the page opens and the gain wired to the speakers: the last stage of the master chain.
async function probeAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe: NonNullable<Window['audioProbe']> = { contexts: [], output: null };
    window.audioProbe = probe;
    const Native = window.AudioContext;
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        probe.contexts.push(this);
      }
    };
    const connect = Reflect.get(AudioNode.prototype, 'connect') as (...rest: unknown[]) => unknown;
    Reflect.set(AudioNode.prototype, 'connect', function (this: AudioNode, ...args: unknown[]) {
      if (args[0] instanceof AudioDestinationNode && this instanceof GainNode) {
        probe.output = this;
      }
      return connect.apply(this, args);
    });
  });
}

function heard(page: Page): Promise<{ state: string | null; gain: number | null }> {
  return page.evaluate(() => ({
    state: window.audioProbe?.contexts[0]?.state ?? null,
    gain: window.audioProbe?.output?.gain.value ?? null,
  }));
}

test('the title plays the menu ambience from the first gesture', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await probeAudio(page);
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Jouer', exact: true })).toBeVisible();

  await page.keyboard.press('Space');

  await expect.poll(async () => (await heard(page)).state).toBe('running');
  await expect.poll(async () => (await heard(page)).gain).toBeGreaterThan(0.9);
  expect(errors).toEqual([]);
});

test('the title stays silent while the sound is off', async ({ page }) => {
  await probeAudio(page);
  await page.addInitScript(() => {
    window.localStorage.setItem('ozoboom.muted', '1');
  });
  await page.goto('./');

  await page.keyboard.press('Space');

  await expect.poll(async () => (await heard(page)).state).toBe('running');
  await expect.poll(async () => (await heard(page)).gain).toBeLessThan(0.01);
});
