import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_BEAT, TICKS_PER_PHRASE, tempoOf } from '../../shared/tempo';
import {
  FIXTURE_CONTENT,
  FIXTURE_OPTIONS,
  FIXTURE_SET,
  eventsOf,
  peaceful,
  stepAndRecord,
} from '../fixtures';
import { createSimulation } from '../index';

const TWO_PHRASES = 2 * TICKS_PER_PHRASE;

describe('tempo', () => {
  it('emits each beat, bar and phrase exactly once, on its first tick', () => {
    const simulation = peaceful(createSimulation(FIXTURE_OPTIONS));
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
    const simulation = peaceful(createSimulation(FIXTURE_OPTIONS));
    const tick = TICKS_PER_PHRASE + 3 * TICKS_PER_BAR + 2 * TICKS_PER_BEAT + 5;

    stepAndRecord(simulation, tick);

    expect(simulation.state.tick).toBe(tick);
    expect(simulation.state.set).toMatchObject({ phrase: 1, bar: 16 + 3, beat: 64 + 3 * 4 + 2 });
  });

  it('counts every phrase held to its end', () => {
    const simulation = peaceful(createSimulation(FIXTURE_OPTIONS));

    stepAndRecord(simulation, TICKS_PER_PHRASE - 1);
    const beforeFirstEnd = simulation.state.stats.phrasesHeld;
    stepAndRecord(simulation, TICKS_PER_PHRASE + 1);

    expect(beforeFirstEnd).toBe(0);
    expect(simulation.state.stats.phrasesHeld).toBe(2);
  });

  describe('at 18 ticks per beat', () => {
    const DOME_BEAT = 18;
    const DOME_BAR = 4 * DOME_BEAT;
    const DOME_PHRASE = 16 * DOME_BAR;
    const domeSet = {
      ...FIXTURE_SET,
      id: 'dome-fixture',
      bpm: tempoOf(DOME_BEAT).bpm,
      ticksPerBeat: DOME_BEAT,
    };
    const domeOptions = {
      ...FIXTURE_OPTIONS,
      setId: 'dome-fixture',
      content: { ...FIXTURE_CONTENT, sets: [domeSet] },
    };

    it('emits a beat every 18 ticks, a bar every 72 and a phrase every 1152', () => {
      const simulation = peaceful(createSimulation(domeOptions));

      const recorded = [
        ...eventsOf(simulation.state),
        ...stepAndRecord(simulation, 2 * DOME_PHRASE),
      ];

      const ticksOf = (type: string): number[] =>
        recorded.filter(({ event }) => event.type === type).map(({ tick }) => tick);
      expect(ticksOf('beat')).toEqual(Array.from({ length: 2 * 64 + 1 }, (_, i) => i * DOME_BEAT));
      expect(ticksOf('bar')).toEqual(Array.from({ length: 2 * 16 + 1 }, (_, i) => i * DOME_BAR));
      expect(ticksOf('phrase')).toEqual([0, DOME_PHRASE, 2 * DOME_PHRASE]);
    });

    it('lasts the segments of the set in bars of the stage', () => {
      const simulation = peaceful(createSimulation(domeOptions));

      const recorded = [
        ...eventsOf(simulation.state),
        ...stepAndRecord(simulation, DOME_PHRASE + 4 * DOME_BAR),
      ];

      const segments = recorded.flatMap(({ tick, event }) =>
        event.type === 'segment' ? [[tick, event.segment]] : [],
      );
      expect(segments).toEqual([
        [0, 'buildup'],
        [DOME_PHRASE, 'break'],
        [DOME_PHRASE + 2 * DOME_BAR, 'drop'],
        [DOME_PHRASE + 3 * DOME_BAR, 'buildup'],
      ]);
    });
  });
});
