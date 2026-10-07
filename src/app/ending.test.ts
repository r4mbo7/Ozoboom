import { describe, expect, it } from 'vitest';
import { TICK_MS } from '../shared/tempo';
import { endingMs, endingTicks } from './ending';

describe('endingTicks', () => {
  it('keeps a lost game on screen for six beats before the end screen', () => {
    const ticks = endingTicks('lost');

    expect(ticks).toBe(72);
    expect(ticks * TICK_MS).toBeCloseTo(2483, 0);
  });

  it('opens the end screen of a won game at once', () => {
    expect(endingTicks('won')).toBe(0);
  });
});

describe('endingMs', () => {
  it('lasts as long as its ticks at the game speed', () => {
    expect(endingMs('lost', 1)).toBeCloseTo(72 * TICK_MS);
    expect(endingMs('lost', 8)).toBeCloseTo((72 * TICK_MS) / 8);
  });
});
