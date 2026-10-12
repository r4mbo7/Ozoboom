import { describe, expect, it } from 'vitest';
import { MAIN_TEMPO, tempoOf } from '../shared/tempo';
import { VIBE_GLOW, createVibeGlow, glowAt, glowBounce, glowLit, lightUp } from './vibe-glow';

const BEAT = MAIN_TEMPO.ticksPerBeat;

describe('the glow of a festival-goer picking up vibes', () => {
  it('is dark before the first vibe', () => {
    const glow = createVibeGlow();

    expect(glowAt(glow, 40, MAIN_TEMPO)).toBe(0);
  });

  it('rises by one step at the tick of a vibe', () => {
    const glow = createVibeGlow();

    lightUp(glow, 40, MAIN_TEMPO);

    expect(glowAt(glow, 40, MAIN_TEMPO)).toBeCloseTo(VIBE_GLOW.perVibe, 9);
  });

  it('falls back within about half a beat, without ever jumping', () => {
    const glow = createVibeGlow();
    lightUp(glow, 40, MAIN_TEMPO);

    const samples = Array.from({ length: BEAT * 2 }, (_, index) =>
      glowAt(glow, 40 + index / 2, MAIN_TEMPO),
    );

    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]).toBeLessThan(samples[index - 1] ?? 0);
    }
    expect(glowAt(glow, 40 + BEAT / 2, MAIN_TEMPO)).toBeLessThan(VIBE_GLOW.perVibe * 0.3);
    expect(glowAt(glow, 40 + BEAT * 2, MAIN_TEMPO)).toBeLessThan(0.01);
  });

  it('keeps a streak lit instead of strobing, and never goes over the cap', () => {
    const glow = createVibeGlow();

    const levels = Array.from({ length: 12 }, (_, index) => {
      lightUp(glow, 40 + index, MAIN_TEMPO);
      return glowAt(glow, 40 + index, MAIN_TEMPO);
    });

    expect(Math.max(...levels)).toBe(VIBE_GLOW.cap);
    expect(glowAt(glow, 40 + 11.9, MAIN_TEMPO)).toBeGreaterThan(1);
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index]).toBeGreaterThanOrEqual(levels[index - 1] ?? 0);
    }
  });

  it('decays in beats: a slower stage keeps the same share after the same share of a beat', () => {
    const slow = tempoOf(18);
    const main = createVibeGlow();
    const dome = createVibeGlow();
    lightUp(main, 0, MAIN_TEMPO);
    lightUp(dome, 0, slow);

    expect(glowAt(dome, slow.ticksPerBeat / 2, slow)).toBeCloseTo(
      glowAt(main, BEAT / 2, MAIN_TEMPO),
      9,
    );
  });

  it('lights the halo and the rim fully from one, and bounces by a tenth at most', () => {
    expect(glowLit(0.5, false)).toBeCloseTo(0.5, 9);
    expect(glowLit(VIBE_GLOW.cap, false)).toBe(1);
    expect(glowBounce(0, false)).toBe(1);
    expect(glowBounce(0.5, false)).toBeCloseTo(1.05, 9);
    expect(glowBounce(VIBE_GLOW.cap, false)).toBeCloseTo(1.1, 9);
  });

  it('halves the halo and drops the bounce in calm mode', () => {
    expect(glowLit(VIBE_GLOW.cap, true)).toBe(0.5);
    expect(glowLit(0.5, true)).toBeCloseTo(0.25, 9);
    expect(glowBounce(VIBE_GLOW.cap, true)).toBe(1);
  });
});
