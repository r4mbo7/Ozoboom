import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR } from '../shared/tempo';
import { TICK_SECONDS } from './clock';
import { CROSSFADE_SECONDS, fadeCurve, fadeTo, presenceAt, presenceGain, restingAt } from './fade';

describe('fadeTo', () => {
  it('takes one bar of the set to bring a silent layer to full level', () => {
    const fade = fadeTo(restingAt(0), 1, 10);

    expect(CROSSFADE_SECONDS).toBeCloseTo(TICKS_PER_BAR * TICK_SECONDS, 9);
    expect(CROSSFADE_SECONDS).toBeCloseTo(1.655, 3);
    expect(fade).toEqual({ from: 0, to: 1, start: 10, seconds: CROSSFADE_SECONDS });
    expect(presenceAt(fade, 10)).toBe(0);
    expect(presenceAt(fade, 10 + CROSSFADE_SECONDS / 2)).toBeCloseTo(0.5, 9);
    expect(presenceAt(fade, 10 + CROSSFADE_SECONDS)).toBe(1);
  });

  it('turns back from where it is, without a jump, and only takes the way back', () => {
    const rising = fadeTo(restingAt(0), 1, 0);
    const turn = CROSSFADE_SECONDS / 4;

    const falling = fadeTo(rising, 0, turn);

    expect(falling.from).toBeCloseTo(presenceAt(rising, turn), 9);
    expect(falling.seconds).toBeCloseTo(CROSSFADE_SECONDS / 4, 9);
    expect(presenceAt(falling, turn + falling.seconds)).toBe(0);
  });

  it('does nothing when the layer is already where it should go', () => {
    const fade = fadeTo(restingAt(1), 1, 3);

    expect(fade.seconds).toBe(0);
    expect(presenceAt(fade, 3)).toBe(1);
  });
});

describe('presenceGain', () => {
  it('keeps the power constant while one layer fades out and the other fades in', () => {
    const outgoing = fadeTo(restingAt(1), 0, 0);
    const incoming = fadeTo(restingAt(0), 1, 0);

    for (let index = 0; index <= 20; index += 1) {
      const time = (index / 20) * CROSSFADE_SECONDS;
      const power =
        presenceGain(presenceAt(outgoing, time)) ** 2 +
        presenceGain(presenceAt(incoming, time)) ** 2;
      expect(power).toBeCloseTo(1, 9);
    }
  });

  it('goes from silence to full level', () => {
    expect(presenceGain(0)).toBe(0);
    expect(presenceGain(1)).toBe(1);
  });
});

describe('fadeCurve', () => {
  it('starts at the current gain, ends at the target and moves one way only', () => {
    const fade = fadeTo(fadeTo(restingAt(0), 1, 0), 0, CROSSFADE_SECONDS / 2);

    const curve = [...fadeCurve(fade)];

    expect(curve[0]).toBeCloseTo(presenceGain(0.5), 6);
    expect(curve.at(-1)).toBe(0);
    expect(curve.length).toBeGreaterThan(50);
    curve.slice(1).forEach((gain, index) => {
      expect(gain).toBeLessThan(curve[index] ?? Number.NaN);
    });
  });
});
