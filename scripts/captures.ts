// Retakes the captures of docs/captures: the stage screen, and each stage at its four moments.
// `pnpm captures` serves the game, plays the short set drawn at full quality (`?dev=fast&crisp`)
// with the gamepad player of the browser tests in a headless Chromium, and stops both at the end.
// Neither the players nor the scene can fall. The dawn comes in the last drop, so its boss stands
// until the drop's light has left the ground and shows the palette; the day is the won set.
import { writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { type Browser, type Page, chromium, devices } from '@playwright/test';
import { createServer } from 'vite';
import {
  PAD,
  collectConsoleErrors,
  playWithPad,
  plugFakeGamepad,
  tapButtonUntil,
} from '../e2e/game.ts';

declare global {
  interface Window {
    // While true, the protected game keeps the boss on its feet, so that the last drop lasts.
    keepBoss?: boolean;
  }
}

interface SetTime {
  status: string;
  fraction: number;
  // The drop's light on the ground, which hides the palette while it lasts.
  dropLight: number;
  segment: string;
}

interface Moment {
  file: string;
  at: (time: SetTime) => boolean;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CAPTURES = fileURLToPath(new URL('../docs/captures/', import.meta.url));
const POLL_MS = 20;
const WAIT_MS = 300_000;
const SETTLE_MS = 600;
const FRAME_MS = 1000 / 60;
const PRESSES = 10;
const PRESS_MS = 2000;

const server = await createServer({
  root: ROOT,
  logLevel: 'warn',
  server: { port: 0, strictPort: false },
});
await server.listen();
const browsers: Browser[] = [];

try {
  const base = server.resolvedUrls?.local[0];
  if (base === undefined) {
    throw new Error('The game server has no local address');
  }
  const url = `${base}?dev=fast&crisp&stages`;
  const { CONTENT } = (await server.ssrLoadModule(
    '/src/data/content.ts',
  )) as typeof import('../src/data/content');
  const { fastContent } = (await server.ssrLoadModule(
    '/src/app/dev.ts',
  )) as typeof import('../src/app/dev');
  const { setFraction, setOf, setTempo } = (await server.ssrLoadModule(
    '/src/sim/lineup.ts',
  )) as typeof import('../src/sim/lineup');
  const { dropFilterIntensity } = (await server.ssrLoadModule(
    '/src/render/drop-filter.ts',
  )) as typeof import('../src/render/drop-filter');
  const { DAWN_AT, NIGHT_END, NIGHT_START } = (await server.ssrLoadModule(
    '/src/shared/palette.ts',
  )) as typeof import('../src/shared/palette');
  const content = fastContent(CONTENT);

  const setTimeOf = async (page: Page): Promise<SetTime> => {
    const state = await page.evaluate(() => {
      const game = window.ozoboom?.state;
      if (game === undefined) {
        throw new Error('No game in the page');
      }
      return { setId: game.setId, tick: game.tick, status: game.status, set: { ...game.set } };
    });
    const set = setOf(content, state.setId);
    return {
      status: state.status,
      fraction: setFraction(set, state),
      dropLight: dropFilterIntensity(state, state.tick, setTempo(set)),
      segment: state.set.segment,
    };
  };

  // Dusk once the first bad vibes are in, night far from any drop, dawn on a ground at rest.
  const moments = (prefix: string): [Moment, Moment, Moment] => [
    {
      file: `${prefix}1-crepuscule`,
      at: ({ status, fraction }) =>
        status === 'running' && fraction >= NIGHT_START / 4 && fraction < NIGHT_START / 2,
    },
    {
      file: `${prefix}2-nuit`,
      at: ({ status, fraction, segment }) =>
        status === 'running' &&
        segment !== 'drop' &&
        fraction >= (NIGHT_START + NIGHT_END) / 2 &&
        fraction <= NIGHT_END,
    },
    {
      file: `${prefix}3-aube`,
      at: ({ status, fraction, dropLight }) =>
        status === 'running' && fraction >= DAWN_AT && dropLight === 0,
    },
  ];

  const waitFor = async (page: Page, at: Moment['at']) => {
    const until = Date.now() + WAIT_MS;
    for (let time = await setTimeOf(page); !at(time); time = await setTimeOf(page)) {
      if (Date.now() > until) {
        throw new Error(`The moment never came, the set is at ${JSON.stringify(time)}`);
      }
      await page.waitForTimeout(POLL_MS);
    }
  };

  const save = async (image: Buffer, file: string) => {
    await writeFile(`${CAPTURES}${file}.png`, image);
    console.info(`docs/captures/${file}.png`);
  };

  // Playwright's own screenshot waits for an animation frame, which a stopped clock never gives.
  const still = async (page: Page) => {
    const session = await page.context().newCDPSession(page);
    const { data } = await session.send('Page.captureScreenshot', { format: 'png' });
    await session.detach();
    return Buffer.from(data, 'base64');
  };

  // The page's clock moves one frame at a time, and stops for a picture: the moment is still on
  // screen when it is taken, however slowly the machine draws.
  const driveClock = (page: Page) => {
    const drive = { held: false, stopped: false };
    let frame = Promise.resolve();
    // A page that dies stops the clock; the next look at the page says why.
    let failure: unknown = null;
    const loop = (async () => {
      while (!drive.stopped) {
        frame = drive.held ? sleep(POLL_MS) : page.clock.runFor(FRAME_MS);
        await frame;
      }
    })().catch((error: unknown) => {
      failure = error;
    });
    return {
      // Runs `look` with the clock stopped.
      held: async <T>(look: () => Promise<T>): Promise<T> => {
        drive.held = true;
        await frame;
        try {
          return await look();
        } finally {
          drive.held = false;
        }
      },
      stop: async () => {
        drive.stopped = true;
        await loop;
        if (failure !== null) {
          throw new Error('The page clock stopped', { cause: failure });
        }
      },
    };
  };

  const shoot = async (page: Page, clock: ReturnType<typeof driveClock>, moment: Moment) => {
    for (;;) {
      await waitFor(page, moment.at);
      const image = await clock.held(async () =>
        moment.at(await setTimeOf(page)) ? still(page) : null,
      );
      if (image !== null) {
        await save(image, moment.file);
        return;
      }
    }
  };

  // A slow frame reads a key late: a press waits for its effect before the next, or it overshoots.
  const pressUntil = async (page: Page, key: string, done: () => Promise<boolean>) => {
    for (let press = 0; press < PRESSES; press += 1) {
      await page.keyboard.press(key);
      const until = Date.now() + PRESS_MS;
      while (Date.now() < until) {
        if (await done()) {
          return;
        }
        await page.waitForTimeout(POLL_MS);
      }
    }
    throw new Error(`${key} never did its effect`);
  };

  // A browser of its own for each page: a long set in software rendering slows the next one down.
  const newPage = async () => {
    const browser = await chromium.launch({
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    browsers.push(browser);
    return browser.newPage({
      ...devices['Desktop Chrome'],
      viewport: { width: 1280, height: 800 },
    });
  };

  const close = async (page: Page, errors: string[]) => {
    await page.context().browser()?.close();
    if (errors.length > 0) {
      throw new Error(`The game logged errors:\n${errors.join('\n')}`);
    }
  };

  {
    const page = await newPage();
    const errors = collectConsoleErrors(page);
    await page.goto(url);
    const stages = page.getByRole('radiogroup', { name: 'Scènes' });
    await pressUntil(page, 'Enter', () => stages.isVisible());
    const dome = stages.getByRole('radio', { name: /Le Dome/ });
    await pressUntil(page, 'ArrowRight', () => dome.isChecked());
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(SETTLE_MS);
    await save(await page.screenshot(), 'ecran-choisis-la-scene');
    await close(page, errors);
  }

  for (const stage of [
    { name: /Main stage/, moments: moments('moment-'), day: 'moment-4-jour-sunrise' },
    { name: /Le Dome/, moments: moments('dome-moment-'), day: 'dome-moment-4-jour' },
  ]) {
    const page = await newPage();
    const errors = collectConsoleErrors(page);
    // Against a stopped clock the music would schedule every note it thinks it missed: the set plays
    // silent, its sound card never running.
    await page.addInitScript(() => {
      Object.defineProperty(AudioContext.prototype, 'state', { get: () => 'suspended' });
    });
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(FRAME_MS);
    const clock = driveClock(page);
    await plugFakeGamepad(page);
    await page.goto(url);
    const stages = page.getByRole('radiogroup', { name: 'Scènes' });
    await tapButtonUntil(page, PAD.A, () => stages.isVisible());
    const radio = stages.getByRole('radio', { name: stage.name });
    await tapButtonUntil(page, PAD.DpadRight, () => radio.isChecked());
    await tapButtonUntil(page, PAD.A, () =>
      page.getByRole('region', { name: 'Pièges' }).isVisible(),
    );

    // Neither the players nor the scene fall, and the last boss stands until the dawn is taken.
    const setId = await page.evaluate(() => window.ozoboom?.state.setId ?? '');
    await page.evaluate(
      (lastTier) => {
        const game = window.ozoboom;
        if (game === undefined) {
          throw new Error('No game in the page');
        }
        window.keepBoss = true;
        let player: (() => void) | null = null;
        const protect = () => {
          player?.();
          const { state } = game;
          state.core.hp = state.core.maxHp;
          for (const one of state.players) {
            one.hp = one.maxHp;
          }
          for (const enemy of state.enemies) {
            if (enemy.isBoss && window.keepBoss === true && state.set.tier === lastTier) {
              enemy.hp = enemy.maxHp;
            }
          }
        };
        Object.defineProperty(game, 'onStep', {
          get: () => protect,
          set: (next: (() => void) | null) => {
            player = next;
          },
        });
      },
      setOf(content, setId).tiers.length - 1,
    );
    const played = playWithPad(page).catch(async (error: unknown) => {
      const offers = await page.evaluate(() => {
        const state = window.ozoboom?.state;
        const player = state?.players[0];
        return JSON.stringify({
          offers: state?.pendingUpgrades,
          weapons: player?.weapons,
          upgrades: player?.upgrades,
        });
      });
      throw new Error(`The gamepad player stopped at ${offers}`, { cause: error });
    });
    const ended = played.then(({ status }) => {
      throw new Error(`The set ended ${String(status)} before its dawn`);
    });
    ended.catch(() => undefined);
    for (const moment of stage.moments) {
      await Promise.race([shoot(page, clock, moment), ended]);
    }
    await page.evaluate(() => {
      window.keepBoss = false;
    });
    const { status } = await played;
    if (status !== 'won') {
      throw new Error(`The set ended ${String(status)}`);
    }
    await page.addStyleTag({ content: '.ui-end { display: none !important; }' });
    await page.waitForTimeout(SETTLE_MS);
    await save(await clock.held(() => still(page)), stage.day);
    await clock.stop();
    await close(page, errors);
  }
} finally {
  await Promise.all(browsers.map((browser) => browser.close()));
  await server.close();
}
