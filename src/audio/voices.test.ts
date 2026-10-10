import { describe, expect, it } from 'vitest';
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
    at: 1,
    step: 0,
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
