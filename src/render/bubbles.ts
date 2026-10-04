import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';

export const BUBBLE_TICKS = 2 * TICKS_PER_BAR;
export const MAX_BUBBLES = 3;
const FADE_IN_TICKS = TICKS_PER_BEAT / 4;
const FADE_OUT_TICKS = TICKS_PER_BEAT;

export interface Bubble {
  enemyId: number;
  start: number;
  x: number;
  y: number;
}

// The speech bubbles of the Bavards on screen: at most MAX_BUBBLES, each gone BUBBLE_TICKS after it opened.
export class BubbleLog {
  private readonly items: Bubble[] = [];

  open(enemyId: number, tick: number, x: number, y: number): void {
    const again = this.items.findIndex((bubble) => bubble.enemyId === enemyId);
    if (again >= 0) {
      this.items.splice(again, 1);
    } else if (this.items.length >= MAX_BUBBLES) {
      this.items.shift();
    }
    this.items.push({ enemyId, start: tick, x, y });
  }

  live(now: number): readonly Bubble[] {
    let kept = 0;
    for (const bubble of this.items) {
      if (now - bubble.start < BUBBLE_TICKS) {
        this.items[kept] = bubble;
        kept += 1;
      }
    }
    this.items.length = kept;
    return this.items;
  }

  clear(): void {
    this.items.length = 0;
  }
}

export function bubbleAlpha(age: number): number {
  if (age < 0 || age >= BUBBLE_TICKS) {
    return 0;
  }
  return Math.min(1, age / FADE_IN_TICKS, (BUBBLE_TICKS - age) / FADE_OUT_TICKS);
}
