import { describe, expect, it } from 'vitest';
import { MAIN_TEMPO, tempoOf } from '../shared/tempo';
import { sixteenthSeconds } from './clock';
import { DRUM_VOICES } from './drums';
import { MUSIC_VOICES, type MusicVoiceContext } from './voices';

const noop = () => undefined;

function fakeContext() {
  let oscillators = 0;
  const node = (): Record<string, unknown> => {
    const param = () => ({
      value: 0,
      setValueAtTime: noop,
      linearRampToValueAtTime: noop,
      exponentialRampToValueAtTime: noop,
    });
    return {
      context,
      gain: param(),
      pan: param(),
      frequency: param(),
      detune: param(),
      Q: param(),
      connect: (to: unknown) => to,
      start: noop,
      stop: noop,
    };
  };
  const context: Record<string, unknown> = {
    createGain: node,
    createStereoPanner: node,
    createBiquadFilter: node,
    createOscillator: () => {
      oscillators += 1;
      return node();
    },
  };
  return { out: { context } as unknown as AudioNode, count: () => oscillators };
}

const play = (voice: keyof typeof MUSIC_VOICES, overrides: Partial<MusicVoiceContext> = {}) => {
  const { out, count } = fakeContext();
  MUSIC_VOICES[voice]({
    out,
    send: out,
    echo: out,
    at: 1,
    step: 0,
    tempo: MAIN_TEMPO,
    position: 0,
    hz: 220,
    fromHz: 220,
    steps: 8,
    cutoff: 2000,
    light: false,
    until: 100,
    accent: false,
    slide: false,
    legato: false,
    gain: 1,
    ...overrides,
  });
  return count();
};

describe('ceremony voices', () => {
  it.each([
    ['kalimba', 2],
    ['bowl', 4],
    ['siren', 2],
    ['choir', 9],
  ] as const)('%s plays its oscillators', (voice, oscillators) => {
    expect(play(voice)).toBeGreaterThanOrEqual(oscillators);
  });

  it('keeps the choir from throwing when the cut leaves no room for it', () => {
    expect(() => play('choir', { until: 1.2 })).not.toThrow();
  });
});

interface Probe {
  out: AudioNode;
  send: AudioNode;
  oscillators: number;
  sources: number;
  ends: number[];
}

function probe(): Probe {
  const result = { oscillators: 0, sources: 0, ends: [] } as unknown as Probe;
  const param = () => ({
    value: 0,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
  });
  const node = () => ({
    connect: (target: unknown) => target,
    get context(): unknown {
      return context;
    },
  });
  const context = {
    sampleRate: 8000,
    createBuffer: (_channels: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
    createGain: () => ({ ...node(), gain: param() }),
    createStereoPanner: () => ({ ...node(), pan: param() }),
    createBiquadFilter: () => ({ ...node(), frequency: param(), Q: param(), type: 'lowpass' }),
    createOscillator: () => {
      result.oscillators += 1;
      return {
        ...node(),
        frequency: param(),
        detune: param(),
        start: () => undefined,
        stop: (at: number) => result.ends.push(at),
      };
    },
    createBufferSource: () => {
      result.sources += 1;
      return { ...node(), start: () => undefined, stop: (at: number) => result.ends.push(at) };
    },
  };
  result.out = { context } as unknown as AudioNode;
  result.send = { context } as unknown as AudioNode;
  return result;
}

function contextOf(rig: Probe, overrides: Partial<MusicVoiceContext> = {}): MusicVoiceContext {
  return {
    out: rig.out,
    send: rig.send,
    echo: rig.send,
    at: 1,
    step: 0,
    tempo: MAIN_TEMPO,
    position: 0,
    hz: 440,
    fromHz: 440,
    steps: 2,
    cutoff: 2000,
    light: false,
    until: Number.POSITIVE_INFINITY,
    accent: false,
    slide: false,
    legato: false,
    gain: 1,
    ...overrides,
  };
}

describe('oriental voices', () => {
  it('plays the darbouka doum longer than the tek', () => {
    const doum = probe();
    const tek = probe();

    MUSIC_VOICES.darbouka(contextOf(doum, { accent: true }));
    MUSIC_VOICES.darbouka(contextOf(tek));

    expect([doum.oscillators, doum.sources]).toEqual([1, 1]);
    expect([tek.oscillators, tek.sources]).toEqual([1, 1]);
    expect(Math.max(...doum.ends)).toBeGreaterThan(Math.max(...tek.ends));
  });

  it('shakes the riq in three noise bursts', () => {
    const rig = probe();

    MUSIC_VOICES.riq(contextOf(rig));

    expect(rig.sources).toBe(3);
    expect(rig.oscillators).toBe(0);
  });

  it('plucks the oud and lets it ring past the note', () => {
    const rig = probe();

    MUSIC_VOICES.oud(contextOf(rig));

    expect(rig.oscillators).toBe(2);
    expect(Math.max(...rig.ends)).toBeGreaterThan(1.4);
  });

  it('holds the ney for its length with a breath of noise, and stops it at the cut', () => {
    const held = probe();
    const cut = probe();
    const sixteenth = sixteenthSeconds();

    MUSIC_VOICES.ney(contextOf(held, { steps: 8 }));
    MUSIC_VOICES.ney(contextOf(cut, { steps: 8, until: 1 + sixteenth }));

    expect(held.sources).toBe(1);
    expect(Math.max(...held.ends)).toBeGreaterThan(1 + 8 * sixteenth * 0.85);
    expect(Math.max(...cut.ends)).toBeLessThan(1 + sixteenth + 0.3);
  });

  it('holds a note of four sixteenths for 621 ms at the Dome and as before on the main stage', () => {
    const main = probe();
    const dome = probe();
    const domeTempo = tempoOf(18);

    MUSIC_VOICES.ney(contextOf(main, { steps: 4 }));
    MUSIC_VOICES.ney(contextOf(dome, { steps: 4, tempo: domeTempo }));

    expect(4 * sixteenthSeconds(domeTempo)).toBeCloseTo(0.621, 3);
    expect(Math.max(...dome.ends) - Math.max(...main.ends)).toBeCloseTo(
      4 * 0.85 * (sixteenthSeconds(domeTempo) - sixteenthSeconds()),
      6,
    );
  });
});

function spyGains(rig: Probe) {
  const nodes: { gain: { value: number } }[] = [];
  const peaks: number[] = [];
  const context = rig.out.context as unknown as {
    createGain: () => { gain: { value: number; linearRampToValueAtTime: unknown } };
  };
  const create = context.createGain;
  context.createGain = () => {
    const node = create();
    node.gain.linearRampToValueAtTime = (value: number) => peaks.push(value);
    nodes.push(node);
    return node;
  };
  return {
    sends: () => nodes.map((node) => node.gain.value).filter((value) => value !== 0),
    peaks: () => peaks,
  };
}

describe('dub and dome voices', () => {
  it('holds the sub for the length of its note and stops it at the cut', () => {
    const held = probe();
    const longer = probe();
    const cut = probe();
    const sixteenth = sixteenthSeconds();

    MUSIC_VOICES.sub(contextOf(held, { steps: 4 }));
    MUSIC_VOICES.sub(contextOf(longer, { steps: 12 }));
    MUSIC_VOICES.sub(contextOf(cut, { steps: 12, until: 1 + sixteenth }));

    expect(Math.max(...longer.ends) - Math.max(...held.ends)).toBeCloseTo(8 * 0.85 * sixteenth, 6);
    expect(Math.max(...cut.ends)).toBeLessThan(1 + sixteenth + 0.12);
  });

  it('puts a saw above the sub, opened by the bass cutoff', () => {
    const rig = probe();

    MUSIC_VOICES['sub-saw'](contextOf(rig, { steps: 4 }));

    expect(rig.oscillators).toBe(1);
  });

  it('plays the skank as one chord stab with a send into the echo, bigger in the break', () => {
    const [drop, brk] = [false, true].map((light) => {
      const rig = probe();
      const gains = spyGains(rig);
      MUSIC_VOICES.skank(contextOf(rig, { light }));
      return { oscillators: rig.oscillators, send: gains.sends() };
    });

    expect(drop).toEqual({ oscillators: 1, send: [0.5] });
    expect(brk).toEqual({ oscillators: 1, send: [0.85] });
  });

  it('gives the flute a breath of a harmonic and a vibrato only on long notes', () => {
    const short = probe();
    const long = probe();

    MUSIC_VOICES.flute(contextOf(short, { steps: 2 }));
    MUSIC_VOICES.flute(contextOf(long, { steps: 8 }));

    expect(short.oscillators).toBe(2);
    expect(long.oscillators).toBe(3);
  });

  it('plays the melodica as two detuned squares', () => {
    const rig = probe();

    MUSIC_VOICES.melodica(contextOf(rig, { steps: 2 }));

    expect(rig.oscillators).toBe(2);
  });

  it('modulates the siren with a saw LFO', () => {
    const rig = probe();

    MUSIC_VOICES.siren(contextOf(rig, { steps: 12 }));

    expect(rig.oscillators).toBe(2);
  });

  it('scales the bowl with the part level', () => {
    const loud = probe();
    const soft = probe();
    const loudPeaks = spyGains(loud);
    const softPeaks = spyGains(soft);

    MUSIC_VOICES.bowl(contextOf(loud, { gain: 1 }));
    MUSIC_VOICES.bowl(contextOf(soft, { gain: 0.5 }));

    expect(softPeaks.peaks()).toEqual(loudPeaks.peaks().map((peak) => peak / 2));
  });
});

describe('ambyss voices', () => {
  it('plucks a saw and its octave, with a share into the echo', () => {
    const rig = probe();
    const gains = spyGains(rig);

    MUSIC_VOICES['sunrise-pluck'](contextOf(rig));

    expect(rig.oscillators).toBe(2);
    expect(gains.sends()).toEqual([0.35]);
  });

  it('bows three saws, with a vibrato only on long notes, and scales them with the part', () => {
    const short = probe();
    const long = probe();
    const loud = probe();
    const shortPeaks = spyGains(short);
    const loudPeaks = spyGains(loud);

    MUSIC_VOICES.strings(contextOf(short, { steps: 2 }));
    MUSIC_VOICES.strings(contextOf(long, { steps: 8 }));
    MUSIC_VOICES.strings(contextOf(loud, { steps: 2, gain: 1.6 }));

    expect(short.oscillators).toBe(3);
    expect(long.oscillators).toBe(6);
    expect(loudPeaks.peaks()).toEqual(shortPeaks.peaks().map((peak) => peak * 1.6));
  });

  it('holds the ooh over the bar and stops it at the cut', () => {
    const held = probe();
    const cut = probe();
    const sixteenth = sixteenthSeconds();

    MUSIC_VOICES.ooh(contextOf(held, { steps: 16 }));
    MUSIC_VOICES.ooh(contextOf(cut, { steps: 16, until: 2.8 }));

    expect(held.oscillators).toBe(9);
    expect(Math.max(...held.ends)).toBeGreaterThan(2.6 + 12 * sixteenth);
    expect(Math.max(...cut.ends)).toBeCloseTo(2.8, 6);
  });

  it('stops the strings at the cut, their slow attack included', () => {
    const cut = probe();

    MUSIC_VOICES.strings(contextOf(cut, { steps: 8, until: 1.8 }));

    expect(cut.oscillators).toBeGreaterThan(0);
    expect(Math.max(...cut.ends)).toBeCloseTo(1.8, 6);
  });

  it('sings the aah as a short stab of two voices', () => {
    const rig = probe();
    const sixteenth = sixteenthSeconds();

    MUSIC_VOICES.aah(contextOf(rig, { steps: 2 }));

    expect(rig.oscillators).toBe(6);
    expect(Math.max(...rig.ends)).toBeLessThan(1 + 2 * sixteenth + 0.3);
  });
});

describe('psychill voices', () => {
  it('beats twelve sines against each other under the halo, silent at the cut', () => {
    const held = probe();
    const cut = probe();

    MUSIC_VOICES.halo(contextOf(held, { steps: 32 }));
    MUSIC_VOICES.halo(contextOf(cut, { steps: 32, until: 2.8 }));

    expect([held.oscillators, held.sources]).toEqual([12, 0]);
    expect(Math.max(...held.ends)).toBeGreaterThan(1 + 32 * sixteenthSeconds());
    expect(Math.max(...cut.ends)).toBeCloseTo(2.8, 6);
  });

  it('blows the wind as two gusts of noise, silent at the cut', () => {
    const held = probe();
    const cut = probe();

    MUSIC_VOICES.wind(contextOf(held, { steps: 40 }));
    MUSIC_VOICES.wind(contextOf(cut, { steps: 40, until: 2.2 }));

    expect([held.oscillators, held.sources]).toEqual([0, 2]);
    expect(Math.max(...cut.ends)).toBeCloseTo(2.2, 6);
  });

  it('strikes the mallet with a tick of noise, and lets a longer note ring longer', () => {
    const short = probe();
    const long = probe();
    const gains = spyGains(short);

    MUSIC_VOICES.mallet(contextOf(short, { steps: 1 }));
    MUSIC_VOICES.mallet(contextOf(long, { steps: 4 }));

    expect([short.oscillators, short.sources]).toEqual([3, 1]);
    expect(gains.sends()).toEqual([0.75]);
    expect(Math.max(...long.ends)).toBeGreaterThan(Math.max(...short.ends) + 0.5);
  });

  it('glides the sub and its saw down to the note, and stops them at the cut', () => {
    const held = probe();
    const cut = probe();

    MUSIC_VOICES['glide-sub'](contextOf(held, { steps: 8, accent: true }));
    MUSIC_VOICES['glide-sub'](contextOf(cut, { steps: 8, until: 1.4 }));

    expect(held.oscillators).toBe(2);
    expect(Math.max(...cut.ends)).toBeCloseTo(1.4, 6);
  });

  it('breathes noise under the bansuri, with a vibrato only on long notes', () => {
    const grace = probe();
    const long = probe();
    const cut = probe();

    MUSIC_VOICES.bansuri(contextOf(grace, { steps: 1 }));
    MUSIC_VOICES.bansuri(contextOf(long, { steps: 8 }));
    MUSIC_VOICES.bansuri(contextOf(cut, { steps: 8, until: 1.5 }));

    expect([grace.oscillators, grace.sources]).toEqual([3, 1]);
    expect(long.oscillators).toBe(5);
    expect(Math.max(...cut.ends)).toBeCloseTo(1.5, 6);
  });

  it('chirps the bird four times, each with a warble', () => {
    const rig = probe();

    MUSIC_VOICES.bird(contextOf(rig));

    expect(rig.oscillators).toBe(8);
  });

  it('pops the bubble as a square and a sine, half of it into the echo', () => {
    const rig = probe();
    const gains = spyGains(rig);

    MUSIC_VOICES.bubble(contextOf(rig));

    expect(rig.oscillators).toBe(2);
    expect(gains.sends()).toEqual([0.5]);
  });
});

describe('psychill drums', () => {
  const hit = (rig: Probe, hz?: number) => ({
    out: rig.out,
    at: 1,
    gain: 1,
    pan: undefined,
    hz,
    release: undefined,
    kick: { fromHz: 150, toHz: 33, release: 0.26 },
  });

  it('sweeps the udu down to its pitch with a slap of noise', () => {
    const rig = probe();

    DRUM_VOICES.udu(hit(rig, 196));

    expect([rig.oscillators, rig.sources]).toEqual([2, 1]);
  });

  it('shakes the cabasa as one burst of noise', () => {
    const rig = probe();

    DRUM_VOICES.cabasa(hit(rig));

    expect([rig.oscillators, rig.sources]).toEqual([0, 1]);
  });
});
