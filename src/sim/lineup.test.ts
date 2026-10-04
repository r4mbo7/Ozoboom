import { describe, expect, it } from 'vitest';
import { SETS } from '../data/sets';
import type { SetDefinition } from '../data/types';
import { TICKS_PER_BAR, TICKS_PER_PHRASE } from '../shared/tempo';
import { FIXTURE_CONTENT, FIXTURE_OPTIONS, FIXTURE_SET, peaceful } from './fixtures';
import { createSimulation } from './index';
import {
  type LineupInput,
  lineupCursor,
  lineupSlots,
  setFraction,
  setOf,
  ticksToDrop,
} from './lineup';
import type { GameStatus, SetSegment } from './state';

const set: SetDefinition = {
  ...firstSet(),
  tiers: [
    { buildupPhrases: 4, breakBars: 4, bossId: 'couvre-feu', spawns: [] },
    { buildupPhrases: 2, breakBars: 8, bossId: 'batterie-a-plat', spawns: [] },
  ],
};

const BREAK_START = 4 * TICKS_PER_PHRASE;
const DROP_START = BREAK_START + 4 * TICKS_PER_BAR;

function firstSet(): SetDefinition {
  return FIXTURE_SET;
}

function at(
  tick: number,
  tier: number,
  segment: SetSegment,
  segmentStartTick: number,
  status: GameStatus = 'running',
): LineupInput {
  return { tick, status, set: { tier, segment, segmentStartTick } };
}

describe('setOf', () => {
  it('finds the set the game plays, wherever it sits in the content', () => {
    const encore: SetDefinition = { ...set, id: 'encore' };
    const content = { ...FIXTURE_CONTENT, sets: [...FIXTURE_CONTENT.sets, encore] };

    const played = setOf(content, 'encore');

    expect(played).toBe(encore);
  });

  it('rejects a set the content does not have', () => {
    expect(() => setOf(FIXTURE_CONTENT, 'nope')).toThrow('unknown set "nope"');
  });
});

describe('lineupSlots', () => {
  it('lists each phrase, then a break and a drop per tier, then the sunrise', () => {
    const kinds = lineupSlots(set).map((slot) => `${slot.kind}${String(slot.tier)}`);

    expect(kinds).toEqual([
      'phrase0',
      'phrase0',
      'phrase0',
      'phrase0',
      'break0',
      'drop0',
      'phrase1',
      'phrase1',
      'break1',
      'drop1',
      'sunrise2',
    ]);
  });

  it('lays out the real V0 set as two tiers of four phrases, a break and a drop', () => {
    const soiree = SETS.find((entry) => entry.id === 'soiree-v0');
    if (soiree === undefined) {
      throw new Error('soiree-v0 is missing');
    }

    const kinds = lineupSlots(soiree).map((slot) => slot.kind);

    expect(kinds).toEqual([
      ...['phrase', 'phrase', 'phrase', 'phrase', 'break', 'drop'],
      ...['phrase', 'phrase', 'phrase', 'phrase', 'break', 'drop'],
      'sunrise',
    ]);
  });
});

describe('lineupCursor', () => {
  it('starts at the beginning of the first phrase', () => {
    expect(lineupCursor(set, at(0, 0, 'buildup', 0))).toEqual({ slot: 0, fraction: 0 });
  });

  it('follows the tick inside the current phrase', () => {
    const tick = 2 * TICKS_PER_PHRASE + TICKS_PER_PHRASE / 4;

    expect(lineupCursor(set, at(tick, 0, 'buildup', 0))).toEqual({ slot: 2, fraction: 0.25 });
  });

  it('stays on the last phrase while the sim has not switched to the break', () => {
    expect(lineupCursor(set, at(BREAK_START + 3, 0, 'buildup', 0))).toEqual({
      slot: 3,
      fraction: 1,
    });
  });

  it('counts the break in bars', () => {
    const tick = BREAK_START + 2 * TICKS_PER_BAR;

    expect(lineupCursor(set, at(tick, 0, 'break', BREAK_START))).toEqual({
      slot: 4,
      fraction: 0.5,
    });
  });

  it('marks the drop as open-ended, since it lasts until the boss falls', () => {
    expect(lineupCursor(set, at(DROP_START + 500, 0, 'drop', DROP_START))).toEqual({
      slot: 5,
      fraction: null,
    });
  });

  it('measures the next tier from the tick its build-up started at', () => {
    const start = DROP_START + 1000;
    const tick = start + TICKS_PER_PHRASE + TICKS_PER_PHRASE / 2;

    expect(lineupCursor(set, at(tick, 1, 'buildup', start))).toEqual({ slot: 7, fraction: 0.5 });
  });

  it('lands on the sunrise once the set is won', () => {
    expect(lineupCursor(set, at(99_999, 1, 'drop', DROP_START, 'won'))).toEqual({
      slot: 10,
      fraction: 1,
    });
  });

  it('lands on the sunrise when the tier is past the last one', () => {
    expect(lineupCursor(set, at(99_999, 2, 'drop', DROP_START))).toEqual({
      slot: 10,
      fraction: 1,
    });
  });
});

describe('ticksToDrop', () => {
  it('counts the rest of the build-up and the whole break', () => {
    const tick = 3 * TICKS_PER_PHRASE;

    expect(ticksToDrop(set, at(tick, 0, 'buildup', 0))).toBe(TICKS_PER_PHRASE + 4 * TICKS_PER_BAR);
  });

  it('counts what is left of the break', () => {
    const tick = BREAK_START + TICKS_PER_BAR;

    expect(ticksToDrop(set, at(tick, 0, 'break', BREAK_START))).toBe(3 * TICKS_PER_BAR);
  });

  it('has nothing to count during the drop, after the sunrise or past the last tier', () => {
    expect(ticksToDrop(set, at(4000, 0, 'drop', DROP_START))).toBeNull();
    expect(ticksToDrop(set, at(99_999, 1, 'drop', DROP_START, 'won'))).toBeNull();
    expect(ticksToDrop(set, at(99_999, 2, 'drop', DROP_START))).toBeNull();
  });
});

describe('setFraction', () => {
  it('is the cursor slot over the slot count', () => {
    const tick = 2 * TICKS_PER_PHRASE + TICKS_PER_PHRASE / 2;

    expect(setFraction(set, at(tick, 0, 'buildup', 0))).toBe(2.5 / 11);
  });

  it('moves over four bars of a drop, then holds until the drop ends', () => {
    const during = (bars: number): number =>
      setFraction(set, at(DROP_START + bars * TICKS_PER_BAR, 0, 'drop', DROP_START));

    expect(during(0)).toBe(5 / 11);
    expect(during(2)).toBe(5.5 / 11);
    expect(during(4)).toBe(6 / 11);
    expect(during(40)).toBe(6 / 11);
  });

  it('is 1 once the set is won or past the last tier', () => {
    expect(setFraction(set, at(99_999, 1, 'drop', DROP_START, 'won'))).toBe(1);
    expect(setFraction(set, at(99_999, 2, 'drop', DROP_START))).toBe(1);
  });

  it('is 0 at tick 0, never goes back and is 1 once a scripted game is won', () => {
    const simulation = peaceful(createSimulation(FIXTURE_OPTIONS));
    const played = setOf(FIXTURE_CONTENT, simulation.state.setId);
    const fractions = [setFraction(played, simulation.state)];

    while (simulation.state.status === 'running') {
      simulation.step([]);
      fractions.push(setFraction(played, simulation.state));
    }

    expect(fractions[0]).toBe(0);
    expect(fractions.slice(1).every((value, index) => value >= (fractions[index] ?? 0))).toBe(true);
    expect(simulation.state.status).toBe('won');
    expect(fractions.at(-1)).toBe(1);
  });
});
