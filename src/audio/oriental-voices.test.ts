import { describe, expect, it } from 'vitest';
import { STEP_TICKS, TICK_SECONDS } from './clock';
import { MUSIC_VOICES, type MusicVoiceContext } from './voices';

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
    at: 1,
    step: 0,
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
    const sixteenth = STEP_TICKS * TICK_SECONDS;

    MUSIC_VOICES.ney(contextOf(held, { steps: 8 }));
    MUSIC_VOICES.ney(contextOf(cut, { steps: 8, until: 1 + sixteenth }));

    expect(held.sources).toBe(1);
    expect(Math.max(...held.ends)).toBeGreaterThan(1 + 8 * sixteenth * 0.85);
    expect(Math.max(...cut.ends)).toBeLessThan(1 + sixteenth + 0.3);
  });
});
