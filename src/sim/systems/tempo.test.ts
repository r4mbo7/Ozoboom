import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_BEAT, TICKS_PER_PHRASE } from '../../shared/tempo';
import { FIXTURE_OPTIONS, eventsOf, stepAndRecord } from '../fixtures';
import { createSimulation } from '../index';

const TWO_PHRASES = 2 * TICKS_PER_PHRASE;

describe('tempo', () => {
  it('emits each beat, bar and phrase exactly once, on its first tick', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    const initial = eventsOf(simulation.state);

    const recorded = [...initial, ...stepAndRecord(simulation, TWO_PHRASES)];

    const beats = recorded.filter(({ event }) => event.type === 'beat');
    const bars = recorded.filter(({ event }) => event.type === 'bar');
    const phrases = recorded.filter(({ event }) => event.type === 'phrase');
    expect(beats).toEqual(
      Array.from({ length: 2 * 64 + 1 }, (_, beat) => ({
        tick: beat * TICKS_PER_BEAT,
        event: { type: 'beat', beat },
      })),
    );
    expect(bars).toEqual(
      Array.from({ length: 2 * 16 + 1 }, (_, bar) => ({
        tick: bar * TICKS_PER_BAR,
        event: { type: 'bar', bar },
      })),
    );
    expect(phrases).toEqual(
      Array.from({ length: 3 }, (_, phrase) => ({
        tick: phrase * TICKS_PER_PHRASE,
        event: { type: 'phrase', phrase },
      })),
    );
  });

  it('keeps the beat, bar and phrase counters of the set in step with the tick', () => {
    const simulation = createSimulation(FIXTURE_OPTIONS);
    const tick = TICKS_PER_PHRASE + 3 * TICKS_PER_BAR + 2 * TICKS_PER_BEAT + 5;

    stepAndRecord(simulation, tick);

    expect(simulation.state.tick).toBe(tick);
    expect(simulation.state.set).toMatchObject({ phrase: 1, bar: 16 + 3, beat: 64 + 3 * 4 + 2 });
  });
});
