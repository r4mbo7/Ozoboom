import { type Page, expect } from '@playwright/test';
import type { SimState } from '../src/sim/state';

export interface SeatSummary {
  playerId: number;
  name: string | null;
  classId: string;
  device: string | null;
  local: boolean;
}

export interface FakePad {
  axes: number[];
  buttons: number[];
}

declare global {
  interface Window {
    // Exposed by the game behind `?dev=fast` and `?dev=bench` only (src/app/dev.ts).
    ozoboom?: {
      readonly state: SimState;
      readonly seats: readonly SeatSummary[];
      readonly hash: string;
      readonly online: {
        readonly role: 'host' | 'guest';
        readonly pending: number;
        readonly roundTripMs: number | null;
        readonly connectMs: number | null;
      } | null;
      forceVersion: string | null;
      // A test's player, called after every step of the game: the next step reads the devices again.
      onStep: (() => void) | null;
    };
    fakePad?: FakePad;
    fakePads?: (FakeSlot | null)[];
  }
}

// One slot of navigator.getGamepads(): `null` leaves the slot empty, like a controller unplugged.
// `rumbles` records the [strength, duration] of every vibration the game asks of that controller.
export interface FakeSlot extends FakePad {
  rumbles: [number, number][];
}

// Buttons of the standard Gamepad API mapping, named after the Xbox controller.
export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  RT: 7,
  Start: 9,
  DpadUp: 12,
  DpadDown: 13,
  DpadRight: 15,
} as const;

export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  return errors;
}

// Replaces navigator.getGamepads() with one standard-mapping controller driven by window.fakePad.
export async function plugFakeGamepad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pad: FakePad = { axes: [0, 0, 0, 0], buttons: new Array<number>(17).fill(0) };
    window.fakePad = pad;
    navigator.getGamepads = () => [
      {
        index: 0,
        id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
        mapping: 'standard',
        connected: true,
        timestamp: performance.now(),
        axes: [...pad.axes],
        buttons: pad.buttons.map((value) => ({
          pressed: value > 0.5,
          touched: value > 0.5,
          value,
        })),
        vibrationActuator: null,
        hapticActuators: [],
      } as unknown as Gamepad,
    ];
  });
}

// Like plugFakeGamepad, with `count` controllers in window.fakePads, one per getGamepads() slot.
// Set a slot to null to unplug it, and back to a fresh slot to plug it again.
export async function plugFakeGamepads(page: Page, count: number): Promise<void> {
  await page.addInitScript((slots) => {
    const pads: (FakeSlot | null)[] = Array.from({ length: slots }, () => ({
      axes: [0, 0, 0, 0],
      buttons: new Array<number>(17).fill(0),
      rumbles: [],
    }));
    window.fakePads = pads;
    navigator.getGamepads = () =>
      pads.map((pad, index) => {
        if (pad === null) return null;
        return {
          index,
          id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
          mapping: 'standard',
          connected: true,
          timestamp: performance.now(),
          axes: [...pad.axes],
          buttons: pad.buttons.map((value) => ({
            pressed: value > 0.5,
            touched: value > 0.5,
            value,
          })),
          vibrationActuator: {
            playEffect: (_type: string, params: { strongMagnitude: number; duration: number }) => {
              pad.rumbles.push([params.strongMagnitude, params.duration]);
              return Promise.resolve('complete');
            },
          },
          hapticActuators: [],
        } as unknown as Gamepad;
      });
  }, count);
}

// The game reads the gamepad once per frame, like a real one: a tap holds the button, or a tilt
// the left stick, for two animation frames, so that one frame of the game sees it and the next one
// sees the pad at rest.
async function pulse(page: Page, change: { button: number } | { leftStick: [number, number] }) {
  await page.evaluate(async (input) => {
    const frames = (count: number) =>
      new Promise<void>((resolve) => {
        const next = (left: number) => {
          if (left === 0) {
            resolve();
          } else {
            requestAnimationFrame(() => {
              next(left - 1);
            });
          }
        };
        next(count);
      });
    const pad = window.fakePad;
    if (pad === undefined) {
      throw new Error('No fake gamepad plugged');
    }
    const set = (on: boolean) => {
      if ('button' in input) {
        pad.buttons[input.button] = on ? 1 : 0;
      } else {
        pad.axes[0] = on ? input.leftStick[0] : 0;
        pad.axes[1] = on ? input.leftStick[1] : 0;
      }
    };
    set(true);
    await frames(2);
    set(false);
    await frames(2);
  }, change);
}

export async function tapButton(page: Page, button: number): Promise<void> {
  await pulse(page, { button });
}

export async function tiltLeftStick(page: Page, x: number, y: number): Promise<void> {
  await pulse(page, { leftStick: [x, y] });
}

// Menus ignore presses for a moment after they open: repeat until the press shows its effect.
export async function repeatUntil(
  action: () => Promise<void>,
  done: () => Promise<boolean>,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await action();
        return done();
      },
      { timeout: 30_000 },
    )
    .toBe(true);
}

export async function tapButtonUntil(
  page: Page,
  button: number,
  done: () => Promise<boolean>,
): Promise<void> {
  await repeatUntil(() => tapButton(page, button), done);
}

// A fusion swaps a gear at its maximum level (5, for every base gear) for its fused form at level
// 1: counting those levels keeps the number of choices from ever going down.
const FUSED_LEVELS = 5;

export interface GameSummary {
  status: SimState['status'];
  level: number;
  // Level choices taken: upgrades, and circus gear gained, levelled up or fused.
  choices: number;
  traps: number;
  player: { x: number; y: number };
  enemies: { x: number; y: number; isBoss: boolean }[];
}

export async function readGame(page: Page): Promise<GameSummary | null> {
  return page.evaluate((fusedLevels) => {
    const state = window.ozoboom?.state;
    const player = state?.players[0];
    if (state === undefined || player === undefined) {
      return null;
    }
    return {
      status: state.status,
      level: player.level,
      choices:
        player.upgrades.length +
        (player.weapons ?? []).reduce((levels, slot) => levels + slot.level, 0) +
        (player.fused?.length ?? 0) * fusedLevels,
      traps: state.traps.length,
      player: { x: player.x, y: player.y },
      enemies: state.enemies.map(({ x, y, isBoss }) => ({ x, y, isBoss })),
    };
  }, FUSED_LEVELS);
}

// A seed whose short set the player of `playWithPad` wins, on the main stage and at the Dome.
// Some seeds are lost by it: a random one would make its games pass or fail by chance.
export const PAD_SEED = 1;

// A player in the page drives the fake gamepad: aims the right stick at the nearest bad vibe and
// fires, picks up the vibes and the loots, stays by the scene, places traps and novas the close
// ones. It plays after every step of the game, so that a loaded machine, which draws fewer frames,
// does not change how it plays. Every level offer is taken with the pad, until the game ends.
// `start` opens the game once the player is seated, so that it plays from the first step: with a
// fixed seed (`&seed=`), the whole game is then the same on every run.
export async function playWithPad(
  page: Page,
  start: () => Promise<void> = () => Promise.resolve(),
): Promise<{ status: SimState['status'] | undefined; upgrades: number }> {
  await page.evaluate(() => {
    const game = window.ozoboom;
    const pad = window.fakePad;
    if (game === undefined || pad === undefined) {
      throw new Error('No game or no fake gamepad');
    }
    const TICKS_BETWEEN_TRAPS = 336;
    let lastTrap = -TICKS_BETWEEN_TRAPS;
    game.onStep = () => {
      const { state } = game;
      const player = state.players[0];
      if (player === undefined) {
        return;
      }
      const running = state.status === 'running';
      const distance = (x: number, y: number) => Math.hypot(x - player.x, y - player.y);
      const nearest = [...state.enemies].sort((a, b) => distance(a.x, a.y) - distance(b.x, b.y))[0];
      const handFree = (player.hand?.length ?? 0) < 2;
      const pickup = [...state.pickups, ...(handFree ? (state.loots ?? []) : [])]
        .filter((candidate) => distance(candidate.x, candidate.y) < 350)
        .sort((a, b) => distance(a.x, a.y) - distance(b.x, b.y))[0];
      const goal = pickup ?? { x: state.core.x - 100, y: state.core.y };
      const toGoal = distance(goal.x, goal.y);
      pad.axes = [
        running && toGoal > 20 ? (goal.x - player.x) / toGoal : 0,
        running && toGoal > 20 ? (goal.y - player.y) / toGoal : 0,
        nearest === undefined ? 0 : (nearest.x - player.x) / distance(nearest.x, nearest.y),
        nearest === undefined ? 0 : (nearest.y - player.y) / distance(nearest.x, nearest.y),
      ];
      pad.buttons[7] = running && nearest !== undefined ? 1 : 0;
      pad.buttons[6] =
        running && state.enemies.some((enemy) => distance(enemy.x, enemy.y) < 140) ? 1 : 0;
      if (!running) {
        // The test taps A itself in the menus.
      } else if (pad.buttons[0] === 1) {
        pad.buttons[0] = 0;
      } else if ((player.hand?.length ?? 0) > 0 && state.tick - lastTrap > TICKS_BETWEEN_TRAPS) {
        pad.buttons[0] = 1;
        lastTrap = state.tick;
      }
      if (state.status === 'won' || state.status === 'lost') {
        pad.axes = [0, 0, 0, 0];
        pad.buttons.fill(0);
        game.onStep = null;
      }
    };
  });
  await start();

  const upgrade = page.getByRole('region', { name: 'Choix d’amélioration' });
  const firstCard = upgrade.getByRole('button').first();
  let upgrades = 0;
  let status = (await readGame(page))?.status;
  while (status !== 'won' && status !== 'lost') {
    if (status === 'choosingUpgrade') {
      await expect(firstCard).toHaveAttribute('aria-current', 'true');
      await tapButtonUntil(
        page,
        PAD.DpadRight,
        async () => (await firstCard.getAttribute('aria-current')) === null,
      );
      // Two levels at once present two offers in a row: a choice shows as one more upgrade, not as a status.
      const chosen = (await readGame(page))?.choices ?? 0;
      await tapButtonUntil(
        page,
        PAD.A,
        async () => ((await readGame(page))?.choices ?? 0) > chosen,
      );
      upgrades += 1;
    }
    await expect
      .poll(async () => (await readGame(page))?.status, { timeout: 150_000 })
      .not.toBe('running');
    status = (await readGame(page))?.status;
  }

  return { status, upgrades };
}

// From the title with a single scene (`?dev`): « Jouer », then « Lancer le set » under the class picked.
export async function playSolo(page: Page, gesture: 'click' | 'tap' = 'click'): Promise<void> {
  await page.getByRole('button', { name: 'Jouer', exact: true })[gesture]();
  await page
    .getByRole('region', { name: 'Choix du perso' })
    .getByRole('button', { name: 'Lancer le set' })
    [gesture]();
}
