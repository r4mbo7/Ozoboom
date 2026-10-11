import { describe, expect, it } from 'vitest';
import { hillAt, paletteAt, sandAt } from '../shared/palette';
import { tempoOf } from '../shared/tempo';
import {
  GROW_TICKS,
  VEIL_COUNT,
  hsl,
  trailGlow,
  trailsAt,
  veilLookAt,
  veilsAt,
} from './cosmic-filter';
import { MASK_BODY, maskTone } from './face-kit';
import { contrast, mixColor } from './ground-sun';
import { parseHexColor } from './palette';

const TEMPO = tempoOf(15);
const CENTER = { x: 800, y: 500 };
const SEED = 42;

describe('trails', () => {
  it('are drawn the same from the same seed and hour', () => {
    const now = 10 * TEMPO.ticksPerBeat + 3.5;

    expect(trailsAt(SEED, now, TEMPO, CENTER)).toEqual(trailsAt(SEED, now, TEMPO, CENTER));
    expect(trailsAt(SEED + 1, now, TEMPO, CENTER)).not.toEqual(trailsAt(SEED, now, TEMPO, CENTER));
  });

  it('are born on the beat, one or two at a time', () => {
    const beat = 40 * TEMPO.ticksPerBeat;

    const before = trailsAt(SEED, beat - 0.1, TEMPO, CENTER);
    const after = trailsAt(SEED, beat, TEMPO, CENTER);

    const born = after.filter((trail) => trail.born === beat);
    expect(born.length).toBeGreaterThanOrEqual(1);
    expect(born.length).toBeLessThanOrEqual(2);
    expect(before.some((trail) => trail.born === beat)).toBe(false);
  });

  it('cross from the east sky down to the west', () => {
    const trails = Array.from({ length: 64 }, (_, beat) =>
      trailsAt(SEED, beat * TEMPO.ticksPerBeat, TEMPO, CENTER),
    ).flat();

    for (const trail of trails) {
      expect(trail.x1).toBeLessThan(trail.x0);
      expect(trail.y1).toBeGreaterThan(trail.y0);
    }
    const meanStart = trails.reduce((sum, trail) => sum + trail.x0, 0) / trails.length;
    expect(meanStart).toBeGreaterThan(CENTER.x);
  });

  it('grow quickly, then fade out within a bar', () => {
    const beat = 40 * TEMPO.ticksPerBeat;
    const trail = trailsAt(SEED, beat, TEMPO, CENTER).find((each) => each.born === beat);
    if (trail === undefined) {
      throw new Error('No trail born on the beat');
    }

    expect(trailGlow(trail, beat, TEMPO)).toEqual({ grow: 0, fade: 1 });
    expect(trailGlow(trail, beat + GROW_TICKS, TEMPO)).toEqual({ grow: 1, fade: 1 });
    expect(trailGlow(trail, beat + TEMPO.ticksPerBeat, TEMPO).fade).toBeLessThan(1);
    const late = beat + TEMPO.ticksPerBar - 1;
    expect(trailGlow(trail, late, TEMPO).fade).toBeLessThan(0.01);
    expect(trailsAt(SEED, late, TEMPO, CENTER)).toContainEqual(trail);
    expect(trailsAt(SEED, beat + TEMPO.ticksPerBar, TEMPO, CENTER)).not.toContainEqual(trail);
  });
});

describe('veils', () => {
  it('slide one pass per phrase', () => {
    const start = veilsAt(0, TEMPO, false);
    const half = veilsAt(TEMPO.ticksPerPhrase / 2, TEMPO, false);
    const next = veilsAt(TEMPO.ticksPerPhrase, TEMPO, false);

    expect(start).toHaveLength(VEIL_COUNT);
    expect(next).toEqual(start);
    expect(half[0]?.offset).toBeGreaterThan(start[0]?.offset ?? Number.POSITIVE_INFINITY);
  });

  it('stand still in calm mode', () => {
    expect(veilsAt(123.4, TEMPO, true)).toEqual(veilsAt(0, TEMPO, true));
  });

  it('are violet at night and golden at dawn', () => {
    const [night] = veilLookAt(0.4).tones;
    const [dawn] = veilLookAt(0.85).tones;

    expect(night & 0xff).toBeGreaterThan((night >> 8) & 0xff);
    expect((dawn >> 16) & 0xff).toBeGreaterThan(dawn & 0xff);
  });

  it('keep the bad vibes at 3:1 on every ground, even where two of them cross', () => {
    const faint: string[] = [];

    for (let index = 0; index <= 200; index += 1) {
      const fraction = index / 200;
      const sun = paletteAt(fraction);
      const sand = sandAt(fraction);
      const hill = hillAt(fraction);
      const rim = parseHexColor(sun.badVibeRim);
      const body = maskTone(rim, MASK_BODY);
      const { tones, alpha } = veilLookAt(fraction);
      for (const hex of [
        sun.sol,
        sun.solClair,
        sand.sable,
        sand.sableClair,
        hill.herbe,
        hill.herbeClaire,
        hill.sable,
        hill.sableClair,
      ]) {
        const ground = parseHexColor(hex);
        const veiled = mixColor(mixColor(ground, tones[0], alpha), tones[1], alpha);
        const silhouette = Math.max(contrast(rim, veiled), contrast(body, veiled));
        if (silhouette < 3) {
          faint.push(`${fraction.toFixed(3)} on ${hex}: ${silhouette.toFixed(2)}:1`);
        }
      }
    }

    expect(faint).toEqual([]);
  });
});

describe('hsl', () => {
  it('turns hues into the colors of the wheel', () => {
    expect(hsl(0, 1, 0.5)).toBe(0xff0000);
    expect(hsl(120, 1, 0.5)).toBe(0x00ff00);
    expect(hsl(240, 1, 0.5)).toBe(0x0000ff);
    expect(hsl(200, 0, 1)).toBe(0xffffff);
  });
});
