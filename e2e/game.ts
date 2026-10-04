import { type Page, expect } from '@playwright/test';
import type { SimState } from '../src/sim/state';

export interface FakePad {
  axes: number[];
  buttons: number[];
}

declare global {
  interface Window {
    // Exposed by the game behind `?dev=fast` and `?dev=bench` only (src/app/dev.ts).
    ozoboom?: { readonly state: SimState };
    fakePad?: FakePad;
  }
}

// Buttons of the standard Gamepad API mapping, named after the Xbox controller.
export const PAD = { A: 0, X: 2, Y: 3, RT: 7, Start: 9, DpadRight: 15 } as const;

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

// The game reads the gamepad once per frame, like a real one: a tap holds the button for two
// animation frames, so that one frame of the game sees it down and the next one sees it up.
export async function tapButton(page: Page, button: number): Promise<void> {
  await page.evaluate(async (index) => {
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
    pad.buttons[index] = 1;
    await frames(2);
    pad.buttons[index] = 0;
    await frames(2);
  }, button);
}

// Menus ignore presses for a moment after they open: tap until the press shows its effect.
export async function tapButtonUntil(
  page: Page,
  button: number,
  done: () => Promise<boolean>,
): Promise<void> {
  await expect
    .poll(async () => {
      await tapButton(page, button);
      return done();
    })
    .toBe(true);
}

export interface GameSummary {
  status: SimState['status'];
  level: number;
  traps: number;
  player: { x: number; y: number };
  enemies: { x: number; y: number; isBoss: boolean }[];
}

export async function readGame(page: Page): Promise<GameSummary | null> {
  return page.evaluate(() => {
    const state = window.ozoboom?.state;
    const player = state?.players[0];
    if (state === undefined || player === undefined) {
      return null;
    }
    return {
      status: state.status,
      level: player.level,
      traps: state.traps.length,
      player: { x: player.x, y: player.y },
      enemies: state.enemies.map(({ x, y, isBoss }) => ({ x, y, isBoss })),
    };
  });
}
