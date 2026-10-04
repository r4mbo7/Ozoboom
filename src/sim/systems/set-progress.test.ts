import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_PHRASE } from '../../shared/tempo';
import {
  FIXTURE_CONTENT,
  FIXTURE_OPTIONS,
  FIXTURE_SET,
  eventsOf,
  stepAndRecord,
} from '../fixtures';
import { createSimulation } from '../index';
import type { EnemyState } from '../state';

const BUILDUP = TICKS_PER_PHRASE;
const BREAK = 2 * TICKS_PER_BAR;
const DROP = TICKS_PER_BAR;
const TIER = BUILDUP + BREAK + DROP;

function boss(id: number): EnemyState {
  return {
    id,
    kind: 'curfew',
    x: 100,
    y: 100,
    prevX: 100,
    prevY: 100,
    radius: 40,
    hp: 500,
    maxHp: 500,
    speed: 1,
    damage: 30,
    target: 'core',
    attackCooldown: 0,
    slowFactor: 1,
    stunTicks: 0,
    marked: false,
    isBoss: true,
  };
}

describe('set progress', () => {
  it('walks the fixture set through buildup, break and drop of each tier, on the bar grid', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    const initial = eventsOf(simulation.state);

    const recorded = [...initial, ...stepAndRecord(simulation, 2 * TIER)];

    const segments = recorded.filter(({ event }) => event.type === 'segment');
    expect(segments).toEqual([
      { tick: 0, event: { type: 'segment', segment: 'buildup', tier: 0 } },
      { tick: BUILDUP, event: { type: 'segment', segment: 'break', tier: 0 } },
      { tick: BUILDUP + BREAK, event: { type: 'segment', segment: 'drop', tier: 0 } },
      { tick: TIER, event: { type: 'segment', segment: 'buildup', tier: 1 } },
      { tick: TIER + BUILDUP, event: { type: 'segment', segment: 'break', tier: 1 } },
      { tick: TIER + BUILDUP + BREAK, event: { type: 'segment', segment: 'drop', tier: 1 } },
    ]);
  });

  it('records where the current segment started', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);

    stepAndRecord(simulation, BUILDUP + 5);

    expect(simulation.state.set).toMatchObject({
      tier: 0,
      segment: 'break',
      segmentStartTick: BUILDUP,
    });
  });

  it('holds the drop while a boss is alive and ends it on the next bar once the boss is gone', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    stepAndRecord(simulation, BUILDUP + BREAK);
    simulation.state.enemies.push(boss(1));

    const whileBossAlive = stepAndRecord(simulation, 4 * TICKS_PER_BAR);
    simulation.state.enemies.length = 0;
    const afterBossGone = stepAndRecord(simulation, TICKS_PER_BAR);

    expect(whileBossAlive.filter(({ event }) => event.type === 'segment')).toEqual([]);
    expect(simulation.state.set).toMatchObject({ tier: 1, segment: 'buildup' });
    expect(afterBossGone.filter(({ event }) => event.type === 'segment')).toEqual([
      {
        tick: BUILDUP + BREAK + 5 * TICKS_PER_BAR,
        event: { type: 'segment', segment: 'buildup', tier: 1 },
      },
    ]);
  });

  it('chains an empty break straight into the drop on the same tick', () => {
    const simulation = createSimulation({
      ...FIXTURE_OPTIONS,
      content: {
        ...FIXTURE_CONTENT,
        sets: [
          { ...FIXTURE_SET, tiers: FIXTURE_SET.tiers.map((tier) => ({ ...tier, breakBars: 0 })) },
        ],
      },
    });

    const recorded = stepAndRecord(simulation, BUILDUP);

    expect(recorded.filter(({ event }) => event.type === 'segment')).toEqual([
      { tick: BUILDUP, event: { type: 'segment', segment: 'break', tier: 0 } },
      { tick: BUILDUP, event: { type: 'segment', segment: 'drop', tier: 0 } },
    ]);
  });
});
