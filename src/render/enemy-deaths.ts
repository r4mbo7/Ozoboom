import type { PaletteToken } from '../shared/palette';
import { TICKS_PER_BEAT } from '../shared/tempo';

export const SMILE_TICKS = TICKS_PER_BEAT;
export const BOSS_SMILE_TICKS = 2 * TICKS_PER_BEAT;
// Calm mode has no burst: after its smile the mask fades.
export const CALM_FADE_TICKS = TICKS_PER_BEAT;

export interface Farewell<V> {
  readonly view: V;
  live: boolean;
  id: number;
  start: number;
  x: number;
  y: number;
  radius: number;
  tilt: number;
  boss: boolean;
  token: PaletteToken;
}

export type FarewellSpec = Omit<Farewell<never>, 'view' | 'live'>;

export interface FarewellHooks<V> {
  // smile and fade run from 0 to 1: the smile first, then, in calm mode only, the fade.
  show(farewell: Farewell<V>, smile: number, fade: number): void;
  hide(view: V): void;
  burst(farewell: Farewell<V>): void;
}

// A bad vibe that was chased smiles for a beat, then bursts into colors. The sim has already
// dropped it: this queue is all that is left of it on screen.
export class Farewells<V> {
  private readonly items: Farewell<V>[];
  private next = 0;

  constructor(capacity: number, create: () => V) {
    this.items = Array.from({ length: capacity }, () => ({
      view: create(),
      live: false,
      id: 0,
      start: 0,
      x: 0,
      y: 0,
      radius: 0,
      tilt: 0,
      boss: false,
      token: 'or',
    }));
  }

  get liveCount(): number {
    return this.items.filter((item) => item.live).length;
  }

  start(spec: FarewellSpec): void {
    const slot = this.items[this.next];
    if (slot === undefined) {
      return;
    }
    this.next = (this.next + 1) % this.items.length;
    Object.assign(slot, spec, { live: true });
  }

  update(now: number, calm: boolean, hooks: FarewellHooks<V>): void {
    for (const item of this.items) {
      if (!item.live) {
        continue;
      }
      const smile = item.boss ? BOSS_SMILE_TICKS : SMILE_TICKS;
      const elapsed = now - item.start;
      if (elapsed < 0) {
        item.live = false;
        hooks.hide(item.view);
      } else if (elapsed < smile) {
        hooks.show(item, elapsed / smile, 0);
      } else if (calm && elapsed < smile + CALM_FADE_TICKS) {
        hooks.show(item, 1, (elapsed - smile) / CALM_FADE_TICKS);
      } else {
        item.live = false;
        hooks.hide(item.view);
        if (!calm) {
          hooks.burst(item);
        }
      }
    }
  }

  clear(hide: (view: V) => void): void {
    for (const item of this.items) {
      item.live = false;
      hide(item.view);
    }
  }
}
