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
