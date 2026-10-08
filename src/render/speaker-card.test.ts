import { describe, expect, it } from 'vitest';
import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../shared/tempo';
import { cardLines, cardOrigin, cardScale, isNear, plugStep } from './speaker-card';

const DOME = {
  name: 'Le Dôme chill',
  description: 'Une brume qui soigne tout ce qui danse autour.',
  plugBars: 2,
};

describe('speaker card lines', () => {
  it('tells an idle speaker how long to stay in it', () => {
    const lines = cardLines(
      DOME,
      'Assiettes chinoises',
      plugStep({ plugTicks: 0, plugged: false }, 2),
      2,
    );

    expect(lines).toEqual([
      'Le Dôme chill',
      'reste deux mesures dedans',
      'Volume +1 · ouvre Assiettes chinoises',
      'Une brume qui soigne tout ce qui danse autour.',
    ]);
  });

  it('says one bar in the singular', () => {
    const lines = cardLines(DOME, null, plugStep({ plugTicks: 0, plugged: false }, 1), 1);

    expect(lines[1]).toBe('reste une mesure dedans');
    expect(lines[2]).toBe('Volume +1');
  });

  it.each([
    [1, 8],
    [TICKS_PER_BEAT, 7],
    [TICKS_PER_BEAT + 1, 7],
    [TICKS_PER_BAR, 4],
    [2 * TICKS_PER_BAR - 1, 1],
  ])('counts the beats left while plugging, %i ticks in: %i', (plugTicks, beats) => {
    const step = plugStep({ plugTicks, plugged: false }, 2);

    expect(step).toBe(beats);
    expect(cardLines(DOME, null, step, 2)[1]).toBe(`branchement : encore ${String(beats)} temps`);
  });

  it('says plugged once it is', () => {
    const step = plugStep({ plugTicks: 0, plugged: true }, 2);

    expect(cardLines(DOME, null, step, 2)[1]).toBe('branchée');
  });
});

describe('speaker card trigger', () => {
  it('opens when any player is within 170 units of the speaker', () => {
    const speaker = { x: 800, y: 120 };

    expect(
      isNear(speaker, [
        { x: 0, y: 0 },
        { x: 800, y: 289 },
      ]),
    ).toBe(true);
    expect(
      isNear(speaker, [
        { x: 0, y: 0 },
        { x: 800, y: 290 },
      ]),
    ).toBe(false);
    expect(isNear(speaker, [])).toBe(false);
  });
});

describe('speaker card placement', () => {
  it('centers the card above its anchor', () => {
    expect(cardOrigin(500, 300, 200, 80, 1280, 720)).toEqual({ x: 400, y: 220 });
  });

  it('keeps the whole card on screen near an edge', () => {
    expect(cardOrigin(20, 30, 200, 80, 1280, 720)).toEqual({ x: 12, y: 12 });
    expect(cardOrigin(1270, 900, 200, 80, 1280, 720)).toEqual({ x: 1068, y: 628 });
  });
});

describe('speaker card on a narrow screen', () => {
  it('keeps its size when it fits', () => {
    expect(cardScale(376, 1280)).toBe(1);
  });

  it('shrinks to fit a phone screen with its margins', () => {
    expect(cardScale(376, 360)).toBeCloseTo(336 / 376);
  });
});
