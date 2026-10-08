import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../sim/state';
import {
  CALM_GLINT_PEAK,
  CALM_GLINT_TICKS,
  GLINT_PEAK,
  GLINT_TICKS,
  frontGlintOf,
  glintAlpha,
  glintStart,
  placeGlint,
} from './front-glint';
import { MIN_TICKS_BETWEEN_FLASHES } from './motion';

const HIT = { type: 'enemyHit', id: 7, damage: 4, x: 0, y: 0 } as const;

function spot() {
  const at = { x: Number.NaN, y: Number.NaN };
  return {
    at,
    position: {
      set(x: number, y: number) {
        at.x = x;
        at.y = y;
      },
    },
    rotation: Number.NaN,
  };
}

describe('frontGlintOf', () => {
  it('lights the guard of the enemy hit on its front', () => {
    const event: SimEvent = { ...HIT, front: true };

    const id = frontGlintOf(event);

    expect(id).toBe(7);
  });

  it('leaves a hit from behind and other events unlit', () => {
    const events: SimEvent[] = [HIT, { type: 'beat', beat: 1 }];

    const ids = events.map(frontGlintOf);

    expect(ids).toEqual([undefined, undefined]);
  });
});

describe('glintStart', () => {
  it('restarts a glint once the flash budget allows it', () => {
    const start = 100;

    const soon = glintStart(start + MIN_TICKS_BETWEEN_FLASHES - 1, start, false);
    const later = glintStart(start + MIN_TICKS_BETWEEN_FLASHES, start, false);

    expect(soon).toBe(start);
    expect(later).toBe(start + MIN_TICKS_BETWEEN_FLASHES);
  });

  it('keeps a calm glint lit from the latest hit', () => {
    const start = 100;

    const next = glintStart(start + 1, start, true);

    expect(next).toBe(start + 1);
  });
});

describe('glintAlpha', () => {
  it('fades a brief glint out from its peak', () => {
    const start = 100;

    const alphas = [0, GLINT_TICKS / 2, GLINT_TICKS].map((age) =>
      glintAlpha(start + age, start, false),
    );

    expect(alphas).toEqual([GLINT_PEAK, GLINT_PEAK / 2, 0]);
  });

  it('holds a calm glint at half intensity, then fades it out slower', () => {
    const start = 100;

    const alphas = [0, CALM_GLINT_TICKS / 2, (3 * CALM_GLINT_TICKS) / 4, CALM_GLINT_TICKS].map(
      (age) => glintAlpha(start + age, start, true),
    );

    expect(CALM_GLINT_PEAK).toBe(GLINT_PEAK / 2);
    expect(alphas).toEqual([CALM_GLINT_PEAK, CALM_GLINT_PEAK, CALM_GLINT_PEAK / 2, 0]);
  });

  it('stays dark when nothing hit the front', () => {
    const alpha = glintAlpha(100, Number.NEGATIVE_INFINITY, false);

    expect(alpha).toBe(0);
  });
});

describe('placeGlint', () => {
  it('sets the glint on the side of the mask it steps toward', () => {
    const target = spot();

    placeGlint(target, 50, 80, 0, 20);

    expect(target.at.x).toBeGreaterThan(50);
    expect(target.at.y).toBeCloseTo(80);
    expect(target.rotation).toBe(0);
  });

  it('follows a mask walking up the screen', () => {
    const target = spot();

    placeGlint(target, 50, 80, -Math.PI / 2, 20);

    expect(target.at.x).toBeCloseTo(50);
    expect(target.at.y).toBeLessThan(80);
  });
});
