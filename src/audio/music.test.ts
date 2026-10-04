import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_PHRASE } from '../shared/tempo';
import type { SetProgress } from '../sim/state';
import { dropTickOf, layersFor, modeOf, phraseAt, segmentAt } from './music';

describe('layersFor', () => {
  it('opens the set on kick, rolling bass and hats only', () => {
    const layers = layersFor('buildup', 0, 0);

    expect(layers).toMatchObject({ kick: true, bass: true, hats: true, hats16: false });
    expect(layers).toMatchObject({ pad: false, arp: false, lead: false });
  });

  it('stacks the pad, then the arpeggio, then the lead, one per phrase', () => {
    const stacked = [1, 2, 3].map((phrase) => {
      const { pad, arp, lead } = layersFor('buildup', 0, phrase);
      return { pad, arp, lead };
    });

    expect(stacked).toEqual([
      { pad: true, arp: false, lead: false },
      { pad: true, arp: true, lead: false },
      { pad: true, arp: true, lead: true },
    ]);
  });

  it('thickens the groove and opens the lead filter on higher tiers', () => {
    const first = layersFor('buildup', 0, 3);
    const second = layersFor('buildup', 1, 0);

    expect(second.hats16).toBe(true);
    expect(second.lead).toBe(true);
    expect(second.leadCutoff).toBeGreaterThan(first.leadCutoff);
  });

  it('pulls the kick, the bass and the hats out on the break', () => {
    const layers = layersFor('break', 1, 5);

    expect(layers).toMatchObject({ kick: false, bass: false, hats: false, lead: false });
    expect(layers.pad).toBe(true);
  });

  it('brings everything back on the drop, brighter than the buildup', () => {
    const drop = layersFor('drop', 0, 0);

    expect(Object.values(drop).every(Boolean)).toBe(true);
    expect(drop.leadCutoff).toBeGreaterThan(layersFor('buildup', 0, 3).leadCutoff);
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
