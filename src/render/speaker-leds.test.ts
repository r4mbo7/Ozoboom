import { describe, expect, it } from 'vitest';
import { MAIN_TEMPO, TICKS_PER_BAR, TICKS_PER_BEAT, tempoOf } from '../shared/tempo';
import { LEDS, danceLevel, litLeds, standbyOn } from './speaker-leds';

const IDS = ['dome-chill', 'foret', 'sub', 'cercle-acid'];
const BEATS = Array.from({ length: 64 }, (_, beat) => beat);

describe('LED column while plugging', () => {
  it.each([
    [0, 0],
    [TICKS_PER_BEAT - 1, 0],
    [TICKS_PER_BEAT, 1],
    [TICKS_PER_BAR, 4],
    [TICKS_PER_BAR * 2 - 1, 7],
  ])('lights one LED per beat of the two plug bars: %i ticks give %i', (plugTicks, lit) => {
    expect(
      litLeds({ id: 'sub', plugTicks, plugged: false }, 2, {
        now: 5,
        calm: false,
        tempo: MAIN_TEMPO,
      }),
    ).toBe(lit);
  });

  it('fills the column in calm mode once plugged', () => {
    expect(
      litLeds({ id: 'sub', plugTicks: 0, plugged: true }, 2, {
        now: 37,
        calm: true,
        tempo: MAIN_TEMPO,
      }),
    ).toBe(LEDS);
  });
});

describe('LED column dancing once plugged', () => {
  it('draws a level from 4 to 8 at the start of each beat', () => {
    const levels = IDS.flatMap((id) => BEATS.map((beat) => danceLevel(beat * TICKS_PER_BEAT, id)));

    expect(Math.min(...levels)).toBe(4);
    expect(Math.max(...levels)).toBe(8);
  });

  it('drops three LEDs during the beat', () => {
    for (const id of IDS) {
      for (const beat of BEATS) {
        const start = danceLevel(beat * TICKS_PER_BEAT, id);

        expect(danceLevel((beat + 0.5) * TICKS_PER_BEAT, id)).toBe(Math.round(start - 1.5));
        expect(danceLevel((beat + 0.99) * TICKS_PER_BEAT, id)).toBe(start - 3);
      }
    }
  });

  it('draws the same level for the same beat and speaker, a different one per speaker', () => {
    const dances = IDS.map((id) => BEATS.map((beat) => danceLevel(beat * TICKS_PER_BEAT, id)));

    expect(IDS.map((id) => BEATS.map((beat) => danceLevel(beat * TICKS_PER_BEAT, id)))).toEqual(
      dances,
    );
    expect(new Set(dances.map((dance) => dance.join())).size).toBe(IDS.length);
  });
});

describe('standby LED', () => {
  it.each([
    [0, true],
    [TICKS_PER_BEAT - 0.1, true],
    [TICKS_PER_BEAT, false],
    [TICKS_PER_BAR - 1, false],
    [TICKS_PER_BAR * 5 + 2, true],
  ])('at %f ticks is lit the first quarter of each bar: %s', (now, on) => {
    expect(standbyOn({ now, calm: false, tempo: MAIN_TEMPO })).toBe(on);
  });

  it('stays lit in calm mode', () => {
    expect(standbyOn({ now: TICKS_PER_BEAT * 2, calm: true, tempo: MAIN_TEMPO })).toBe(true);
  });
});

describe('LEDs at the Dome tempo', () => {
  const dome = tempoOf(18);

  it('dance to a new level every 18 ticks', () => {
    for (const beat of [0, 1, 5, 9]) {
      expect(danceLevel(beat * 18, 'sub', dome)).toBe(danceLevel(beat * 12, 'sub', MAIN_TEMPO));
      expect(danceLevel(beat * 18 + 17.99, 'sub', dome)).toBe(
        danceLevel(beat * 12 + 11.99, 'sub', MAIN_TEMPO),
      );
    }
  });

  it('light one LED per Dome beat while plugging', () => {
    const frame = { now: 5, calm: false, tempo: dome };

    expect(litLeds({ id: 'sub', plugTicks: 17, plugged: false }, 2, frame)).toBe(0);
    expect(litLeds({ id: 'sub', plugTicks: 18, plugged: false }, 2, frame)).toBe(1);
  });

  it('keep the standby LED lit for the first quarter of the 72-tick bar', () => {
    expect(standbyOn({ now: 17.9, calm: false, tempo: dome })).toBe(true);
    expect(standbyOn({ now: 18, calm: false, tempo: dome })).toBe(false);
    expect(standbyOn({ now: 72, calm: false, tempo: dome })).toBe(true);
  });
});
