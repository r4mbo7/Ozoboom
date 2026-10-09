import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_PHRASE } from '../shared/tempo';
import { type DropClock, dropFilterIntensity } from './drop-filter';

const START = 1000;

function clock(tier: number, segment: DropClock['set']['segment'] = 'drop'): DropClock {
  return { status: 'running', set: { tier, segment, segmentStartTick: START } };
}

describe('dropFilterIntensity', () => {
  it('is 0 outside a drop', () => {
    expect(dropFilterIntensity(clock(0, 'buildup'), START + TICKS_PER_BAR)).toBe(0);
    expect(dropFilterIntensity(clock(1, 'break'), START + TICKS_PER_BAR)).toBe(0);
  });

  it('is 0 once the set is won', () => {
    expect(dropFilterIntensity({ ...clock(1), status: 'won' }, START + TICKS_PER_BAR + 10)).toBe(0);
  });

  it('starts at 0 and rises over one bar to half strength on the first drop', () => {
    const first = clock(0);

    expect(dropFilterIntensity(first, START)).toBe(0);
    expect(dropFilterIntensity(first, START + TICKS_PER_BAR / 2)).toBeCloseTo(0.25);
    expect(dropFilterIntensity(first, START + TICKS_PER_BAR)).toBe(0.5);
  });

  it('holds the peak for a phrase, at full strength from the second drop', () => {
    const second = clock(1);

    expect(dropFilterIntensity(second, START + TICKS_PER_BAR)).toBe(1);
    expect(dropFilterIntensity(second, START + TICKS_PER_BAR + TICKS_PER_PHRASE)).toBe(1);
  });

  it('falls over four bars then stays 0 even while the drop goes on', () => {
    const second = clock(1);
    const fallStart = START + TICKS_PER_BAR + TICKS_PER_PHRASE;

    expect(dropFilterIntensity(second, fallStart + 2 * TICKS_PER_BAR)).toBeCloseTo(0.5);
    expect(dropFilterIntensity(second, fallStart + 4 * TICKS_PER_BAR)).toBe(0);
    expect(dropFilterIntensity(second, fallStart + 40 * TICKS_PER_BAR)).toBe(0);
  });
});
