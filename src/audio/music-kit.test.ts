import { describe, expect, it } from 'vitest';
import { SOIREE_OUVERTURE } from '../data/tracks';
import type { DrumPart, MusicTrack, SetDefinition } from '../data/types';
import { FIXTURE_OPTIONS, FIXTURE_SET } from '../sim/fixtures';
import { createSimulation } from '../sim/index';
import { TICKS_PER_BAR } from '../shared/tempo';
import { TICK_SECONDS } from './clock';
import { createMusic } from './music';
import { createReverb, fillImpulse, type Acoustics } from './reverb';

const anyNode: unknown = new Proxy(() => undefined, {
  get: (_, key) => (key === Symbol.toPrimitive ? () => 0 : key === 'then' ? undefined : anyNode),
  apply: () => anyNode,
  set: () => true,
});

interface Rig {
  out: AudioNode;
  starts: number[];
  convolvers: number;
  delays: number;
}

function rig(): Rig {
  const result: Rig = {
    out: undefined as unknown as AudioNode,
    starts: [],
    convolvers: 0,
    delays: 0,
  };
  const node = (extra: object = {}): unknown =>
    new Proxy(
      { context, connect: (to: unknown) => to, disconnect: () => undefined, ...extra },
      { get: (target, key) => (key in target ? (Reflect.get(target, key) as unknown) : anyNode) },
    );
  const source = () => node({ start: (at: number) => result.starts.push(at) });
  const context: unknown = new Proxy(
    {
      currentTime: 0,
      sampleRate: 8000,
      createGain: () => node(),
      createOscillator: source,
      createBufferSource: source,
      createConvolver: () => {
        result.convolvers += 1;
        return node();
      },
      createDelay: () => {
        result.delays += 1;
        return node();
      },
    },
    {
      get: (target, key) => (key in target ? (Reflect.get(target, key) as unknown) : () => node()),
    },
  );
  result.out = node() as AudioNode;
  return result;
}

const CUSTOM_KIT: readonly DrumPart[] = [
  { voice: 'kick', layer: 'kick', loopSteps: 16, hits: [[0, 1]] },
  { voice: 'rim', layer: 'kick', loopSteps: 16, hits: [[6, 0.5]] },
];

const DOME_SET: SetDefinition = {
  ...FIXTURE_SET,
  id: 'fixture-dome',
  ticksPerBeat: 18,
  acoustics: { reverbSeconds: 3, wet: 0.4 },
};

function play(track: MusicTrack, set: SetDefinition | undefined, breakBarsLeft?: number) {
  const rigged = rig();
  const { out, starts } = rigged;
  const kicks: number[] = [];
  const music = createMusic(out, {
    track,
    breakBars: () => 4,
    setOf: set === undefined ? undefined : () => set,
    onKickScheduled: (tick) => kicks.push(tick),
  });
  const { state } = createSimulation(FIXTURE_OPTIONS);
  if (breakBarsLeft !== undefined) {
    state.tick = 4 * TICKS_PER_BAR;
    state.set.segment = 'break';
    state.set.segmentStartTick = (breakBarsLeft - 4) * TICKS_PER_BAR + state.tick;
  }
  music.update(state, 0, 0);
  return {
    kicks,
    sounds: starts.length,
    starts,
    convolvers: () => rigged.convolvers,
    delays: () => rigged.delays,
  };
}

describe('the drum kit of a track', () => {
  it('plays the engine kit when the track has no drums, on the main stage tempo', () => {
    const { kicks, sounds } = play(SOIREE_OUVERTURE, undefined);

    expect(kicks).toEqual([0, 12]);
    expect(sounds).toBeGreaterThan(2);
  });

  it('plays the engine kit at the same times with or without a set that keeps the main tempo', () => {
    const plain = play(SOIREE_OUVERTURE, undefined);
    const mainSet = play(SOIREE_OUVERTURE, { ...FIXTURE_SET });

    expect(mainSet.starts).toEqual(plain.starts);
    expect(mainSet.kicks).toEqual(plain.kicks);
  });

  it('plays its own drums instead of the engine kit', () => {
    const { kicks, sounds } = play({ ...SOIREE_OUVERTURE, drums: CUSTOM_KIT }, undefined);

    expect(kicks).toEqual([0]);
    expect(sounds).toBeLessThan(play(SOIREE_OUVERTURE, undefined).sounds);
  });
});

describe('a drum kept to a segment', () => {
  const kit = (heard: 'rise' | 'drop') =>
    [{ voice: 'kick', layer: 'kick', loopSteps: 16, hits: [[0, 1]], in: heard }] as const;

  it('plays in its own segment only', () => {
    const rise = play({ ...SOIREE_OUVERTURE, drums: kit('rise') }, undefined).kicks;
    const drop = play({ ...SOIREE_OUVERTURE, drums: kit('drop') }, undefined).kicks;

    expect([rise, drop].sort()).toEqual([[], [0]]);
  });
});

describe('the tempo of the set', () => {
  it('sets the beat to 621 ms at 18 ticks per beat', () => {
    const { kicks } = play(SOIREE_OUVERTURE, DOME_SET);

    expect(kicks).toEqual([0, 18]);
    expect(18 * TICK_SECONDS * 1000).toBeCloseTo(620.7, 1);
  });

  it('puts a drum hit on the sixteenth of a longer beat', () => {
    const kit = [{ voice: 'kick', layer: 'kick', loopSteps: 16, hits: [[1, 1]] }] as const;

    const { kicks } = play({ ...SOIREE_OUVERTURE, drums: kit }, DOME_SET);

    expect(kicks).toEqual([4.5]);
  });
});

describe('the dome reverb', () => {
  it('is absent on the main stage and set by the acoustics of a set', () => {
    expect(play(SOIREE_OUVERTURE, { ...FIXTURE_SET }).convolvers()).toBe(0);
    expect(play(SOIREE_OUVERTURE, DOME_SET).convolvers()).toBeGreaterThan(0);
  });

  it('rings from an impulse silent through the pre-delay that falls by 60 dB over the reverb time', () => {
    const samples = new Float32Array(3000);

    fillImpulse(samples, 1000, 2, 1);

    expect(samples.slice(0, 25).every((value) => value === 0)).toBe(true);
    const peak = (from: number, until: number) =>
      Math.max(...samples.slice(from, until).map(Math.abs));
    expect(peak(2000, 2100)).toBeLessThan(peak(100, 200) * 0.01);
  });
});

describe('the echo of a track', () => {
  const echo = { feedback: 0.5, ret: 0.5, tone: 2400 };

  it('repeats through one delay, and bounces between two when the track asks for a wide echo', () => {
    const narrow = play({ ...SOIREE_OUVERTURE, echo }, undefined).delays();
    const wide = play({ ...SOIREE_OUVERTURE, echo: { ...echo, wide: true } }, undefined).delays();

    expect([narrow, wide]).toEqual([1, 2]);
  });
});

describe('a soft build', () => {
  it('leaves the snare roll and the saw of the riser out of the bar before the drop', () => {
    const loud = play(SOIREE_OUVERTURE, undefined, 1).sounds;
    const soft = play({ ...SOIREE_OUVERTURE, build: 'soft' }, undefined, 1).sounds;

    expect(soft).toBeLessThan(loud);
  });

  it('plays the buildup like any other track', () => {
    const loud = play(SOIREE_OUVERTURE, undefined).sounds;
    const soft = play({ ...SOIREE_OUVERTURE, build: 'soft' }, undefined).sounds;

    expect(soft).toBe(loud);
  });
});

describe('the filters of a room', () => {
  function filtersOf(acoustics: Acoustics): (readonly [string, number])[] {
    const filters: { type: string; frequency: { value: number } }[] = [];
    const node = () => ({
      type: '',
      frequency: { value: 0 },
      gain: { value: 0 },
      buffer: null,
      connect: (to: unknown) => to,
      disconnect: () => undefined,
    });
    const context = {
      sampleRate: 8000,
      createGain: node,
      createConvolver: node,
      createBiquadFilter: () => {
        const filter = node();
        filters.push(filter);
        return filter;
      },
      createBuffer: (_channels: number, length: number) => ({
        getChannelData: () => new Float32Array(length),
      }),
    };
    createReverb({ context } as unknown as AudioNode, acoustics);
    return filters.map((filter) => [filter.type, filter.frequency.value]);
  }

  it('lets everything into the room of a set that names no filter', () => {
    expect(filtersOf({ reverbSeconds: 1, wet: 0.3 })).toEqual([]);
  });

  it('keeps the lows out of the room and darkens its tail when the set asks', () => {
    expect(filtersOf({ reverbSeconds: 1, wet: 0.3, lowCutHz: 220, toneHz: 5200 })).toEqual([
      ['highpass', 220],
      ['lowpass', 5200],
    ]);
  });
});
