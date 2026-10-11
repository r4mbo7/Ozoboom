import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_BEAT, TICKS_PER_PHRASE } from '../shared/tempo';
import type { SetProgress } from '../sim/state';
import { STEP_TICKS } from './clock';
import { BRUME_DU_LAC, SOIREE_OUVERTURE } from '../data/tracks';
import {
  CHOKE,
  PULSE,
  breakCueAt,
  dropTickOf,
  latched,
  layersFor,
  modeOf,
  musicCutoff,
  padCutoff,
  partHeard,
  phraseAt,
  pulseGain,
  segmentAt,
} from './music';

describe('layersFor', () => {
  it('opens the set on kick, rolling bass and hats only', () => {
    const layers = layersFor('buildup', 0, 0);

    expect(layers).toMatchObject({ kick: true, bass: true, hats: true, hats16: false });
    expect(layers).toMatchObject({ pad: false, texture: false, arp: false, lead: false });
    expect(layers).toMatchObject({ clap: false, squelch: false, theme: false });
  });

  it('stacks the pad and the forest textures, then the arpeggio, then the lead, one per phrase', () => {
    const stacked = [1, 2, 3].map((phrase) => {
      const { pad, texture, arp, lead } = layersFor('buildup', 0, phrase);
      return { pad, texture, arp, lead };
    });

    expect(stacked).toEqual([
      { pad: true, texture: true, arp: false, lead: false },
      { pad: true, texture: true, arp: true, lead: false },
      { pad: true, texture: true, arp: true, lead: true },
    ]);
  });

  it('thickens the groove, adds the acid line and opens the filters on higher tiers', () => {
    const first = layersFor('buildup', 0, 3);
    const second = layersFor('buildup', 1, 0);

    expect(second).toMatchObject({ hats16: true, lead: true, squelch: true });
    expect(second.leadCutoff).toBeGreaterThan(first.leadCutoff);
    expect(second.bassCutoff).toBeGreaterThan(first.bassCutoff);
  });

  it('plays the theme from the most intense tier, and in every break and drop', () => {
    expect(layersFor('buildup', 0, 3).theme).toBe(false);
    expect(layersFor('buildup', 1, 4).theme).toBe(true);
    expect(layersFor('break', 0, 3).theme).toBe(true);
    expect(layersFor('drop', 0, 3).theme).toBe(true);
  });

  it('empties the break down to the pad, the textures and a muffled lead', () => {
    const layers = layersFor('break', 1, 5);

    expect(layers).toMatchObject({ kick: false, bass: false, hats: false, hats16: false });
    expect(layers).toMatchObject({ clap: false, arp: false, squelch: false });
    expect(layers).toMatchObject({ pad: true, texture: true, lead: true });
    expect(layers.leadCutoff).toBeLessThan(layersFor('drop', 1, 5).leadCutoff);
  });

  it('brings everything back on the drop, brighter than the buildup', () => {
    const drop = layersFor('drop', 0, 0);

    expect(Object.values(drop).every(Boolean)).toBe(true);
    expect(drop.leadCutoff).toBeGreaterThan(layersFor('buildup', 0, 3).leadCutoff);
    expect(drop.bassCutoff).toBeGreaterThan(layersFor('buildup', 0, 3).bassCutoff);
  });
});

describe('layersFor, speakers', () => {
  it('has no speaker layer until a speaker is plugged', () => {
    expect(layersFor('drop', 0, 0).speakers).toEqual([]);
  });

  it('adds one layer per plugged speaker, in a fixed order, and ignores unknown ids', () => {
    const some = layersFor('buildup', 0, 0, ['cercle-acid', 'dome-chill', 'inconnue']);
    const all = layersFor('drop', 0, 0, ['cercle-acid', 'sub', 'foret', 'dome-chill']);

    expect(some.speakers).toEqual(['dome-chill', 'cercle-acid']);
    expect(all.speakers).toEqual(['dome-chill', 'foret', 'sub', 'cercle-acid']);
  });

  it('keeps the plugged layers through the whole set, break included', () => {
    for (const segment of ['buildup', 'break', 'drop'] as const) {
      expect(layersFor(segment, 1, 5, ['foret', 'sub']).speakers).toEqual(['foret', 'sub']);
    }
  });
});

describe('breakCueAt', () => {
  const dropTick = 20 * TICKS_PER_BAR;
  const beforeDrop = (ticks: number) => breakCueAt(dropTick, dropTick - ticks);

  it('leaves the first bar of a four bar break to the atmosphere', () => {
    expect(beforeDrop(4 * TICKS_PER_BAR)).toEqual({ roll: null, cut: false });
    expect(beforeDrop(3 * TICKS_PER_BAR + STEP_TICKS)).toEqual({ roll: null, cut: false });
  });

  it('rolls the snare faster bar after bar: quarters, eighths, sixteenths, then thirty-seconds', () => {
    const rolls = [
      3 * TICKS_PER_BAR,
      2 * TICKS_PER_BAR,
      TICKS_PER_BAR,
      2 * TICKS_PER_BEAT,
      TICKS_PER_BEAT + STEP_TICKS,
    ].map((ticks) => beforeDrop(ticks).roll);

    expect(rolls).toEqual([
      TICKS_PER_BEAT,
      2 * STEP_TICKS,
      STEP_TICKS,
      STEP_TICKS / 2,
      STEP_TICKS / 2,
    ]);
  });

  it('cuts everything on the last beat before the drop', () => {
    expect(beforeDrop(TICKS_PER_BEAT)).toEqual({ roll: null, cut: true });
    expect(beforeDrop(STEP_TICKS)).toEqual({ roll: null, cut: true });
  });

  it('has no cue outside a break or once the drop has started', () => {
    expect(breakCueAt(null, dropTick)).toEqual({ roll: null, cut: false });
    expect(breakCueAt(dropTick, dropTick)).toEqual({ roll: null, cut: false });
  });
});

describe('phraseAt', () => {
  const progress: SetProgress = {
    tier: 0,
    segment: 'buildup',
    phrase: 2,
    bar: 31,
    beat: 127,
    segmentStartTick: 0,
  };
  const tick = 3 * TICKS_PER_PHRASE - 10;

  it('keeps the current phrase until the next phrase line', () => {
    expect(phraseAt(progress, tick, tick + 9)).toBe(2);
  });

  it('anticipates the next phrase for steps scheduled past its first tick', () => {
    expect(phraseAt(progress, tick, tick + 10)).toBe(3);
  });
});

describe('modeOf', () => {
  it('keeps the groove going while an upgrade is being chosen', () => {
    expect(modeOf('running')).toBe('playing');
    expect(modeOf('choosingUpgrade')).toBe('playing');
  });

  it('switches to the ending on victory and defeat', () => {
    expect(modeOf('won')).toBe('won');
    expect(modeOf('lost')).toBe('lost');
  });
});

describe('foreseeing the drop', () => {
  const inBreak: SetProgress = {
    tier: 0,
    segment: 'break',
    phrase: 4,
    bar: 64,
    beat: 256,
    segmentStartTick: 64 * TICKS_PER_BAR,
  };
  const dropTick = 68 * TICKS_PER_BAR;

  it('places the drop breakBars bars after the break started', () => {
    expect(dropTickOf(inBreak, 4)).toBe(dropTick);
    expect(dropTickOf({ ...inBreak, segment: 'buildup' }, 4)).toBeNull();
  });

  it('schedules the drop layers from its first tick while the break still plays', () => {
    expect(segmentAt('break', dropTick, dropTick - 3)).toBe('break');
    expect(segmentAt('break', dropTick, dropTick)).toBe('drop');
    expect(segmentAt('buildup', null, dropTick)).toBe('buildup');
  });
});

describe('padCutoff', () => {
  const inBreak: SetProgress = {
    tier: 0,
    segment: 'break',
    phrase: 4,
    bar: 64,
    beat: 256,
    segmentStartTick: 64 * TICKS_PER_BAR,
  };

  it('opens the pad bar after bar in the break of a track that asks for it', () => {
    const cutoffs = [64, 65, 66, 67].map((bar) => padCutoff(BRUME_DU_LAC, 'break', inBreak, bar));

    expect(cutoffs).toEqual([900, 1200, 1500, 1800]);
    expect(padCutoff(BRUME_DU_LAC, 'drop', inBreak, 68)).toBe(900);
    expect(padCutoff(SOIREE_OUVERTURE, 'break', inBreak, 67)).toBe(900);
  });
});

describe('the scene in danger', () => {
  const pulsedSixteenths = (life: number) => {
    const pulse = latched(false, life, PULSE);
    const choke = latched(false, life, CHOKE);
    return [...Array(16).keys()].filter((sixteenth) => pulseGain(sixteenth, pulse, choke) > 0);
  };

  it('beats a pulse between two kicks below a quarter of the scene life, twice per bar below a tenth', () => {
    expect(pulsedSixteenths(0.5)).toEqual([]);
    expect(pulsedSixteenths(0.24)).toEqual([2, 3]);
    expect(pulsedSixteenths(0.09)).toEqual([2, 3, 10, 11]);
  });

  it('strikes the second beat of each pulse softer than the first', () => {
    expect(pulseGain(2, true, true)).toBe(0.55);
    expect(pulseGain(3, true, true)).toBe(0.4);
    expect(pulseGain(10, true, true)).toBe(0.55);
    expect(pulseGain(11, true, true)).toBe(0.4);
  });

  it('keeps each sound until the scene climbs two points above its threshold', () => {
    expect(latched(false, 0.25, PULSE)).toBe(false);
    expect(latched(true, 0.26, PULSE)).toBe(true);
    expect(latched(true, 0.27, PULSE)).toBe(false);
    expect(latched(true, 0.11, CHOKE)).toBe(true);
    expect(latched(true, 0.12, CHOKE)).toBe(false);
  });

  it('chokes the music filter as the scene dies below a tenth, and opens it fully once it recovers', () => {
    expect(musicCutoff(false, 0.5)).toBe(20_000);
    expect(musicCutoff(true, 0.1)).toBeCloseTo(3000);
    expect(musicCutoff(true, 0.05)).toBeCloseTo(Math.sqrt(380 * 3000));
    expect(musicCutoff(true, 0)).toBeCloseTo(380);
    expect(musicCutoff(latched(true, 0.12, CHOKE), 0.12)).toBe(20_000);
  });
});

describe('partHeard', () => {
  it.each([
    [undefined, { buildup: true, break: true, drop: true }],
    ['light', { buildup: false, break: true, drop: false }],
    ['full', { buildup: true, break: false, drop: true }],
    ['rise', { buildup: true, break: false, drop: false }],
    ['drop', { buildup: false, break: false, drop: true }],
  ] as const)('lets a part marked %s play in %j', (heard, expected) => {
    expect({
      buildup: partHeard(heard, 'buildup'),
      break: partHeard(heard, 'break'),
      drop: partHeard(heard, 'drop'),
    }).toEqual(expected);
  });
});
