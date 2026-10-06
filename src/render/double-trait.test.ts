import { Container, Texture } from 'pixi.js';
import { TICKS_PER_BEAT } from '../shared/tempo';
import { describe, expect, it } from 'vitest';
import { lightAt, paletteAt } from '../shared/palette';
import type { RenderContext } from './context';
import { createCore, lostSegmentShown } from './core';
import { createFixtureState, FIXTURE_CONTENT } from './fixture';
import { contrast } from './ground-sun';
import { type Frame, createFrame } from './frame';
import { createLayers } from './layers';
import { writePixiPalette } from './palette';
import { createPickups } from './pickups';
import type { Shape } from './textures';
import { TRAP_TOKENS } from './textures';
import { createTraps } from './traps';
import { LOW_SHARE, SEGMENTS, litSegments, litShare, percentOf } from './vu-meter';

const MOMENTS = [0, 0.4, 0.85, 1] as const;

function frameAt(fraction: number): Frame {
  const frame = createFrame();
  frame.fraction = fraction;
  frame.light = lightAt(fraction);
  writePixiPalette(frame.palette, paletteAt(fraction));
  return frame;
}

function context(): RenderContext {
  const shape: Shape = { texture: Texture.EMPTY, radius: 32 };
  return {
    textures: {
      halo: shape,
      ring: shape,
      core: shape,
      coreRay: shape,
      beam: shape,
      pip: shape,
      vibes: shape,
      watts: shape,
      traps: { shockwave: shape, beam: shape, mist: shape, lure: shape, strobe: shape },
      names: { get: () => ({ fill: Texture.EMPTY, edge: Texture.EMPTY }) },
    },
    layers: createLayers(new Container()),
    options: { calmMode: false },
    classTokens: new Map(),
    behaviours: new Map(),
    trapLooks: new Map(FIXTURE_CONTENT.traps.map((def) => [def.id, def])),
  } as unknown as RenderContext;
}

describe('core ring', () => {
  it.each([
    [100, 100, 1],
    [62, 100, 0.62],
    [0, 100, 0],
    [-5, 100, 0],
    [140, 100, 1],
  ])('lights %i of %i hit points as %f of the ring', (hp, maxHp, share) => {
    expect(litShare({ hp, maxHp })).toBeCloseTo(share);
  });

  it.each([
    [500, 500, 24, 100],
    [480, 500, 24, 96],
    [125, 500, 6, 25],
    [1, 500, 1, 1],
    [0, 500, 0, 0],
  ])('lights %i of %i hit points as %i segments and %i %%', (hp, maxHp, segments, percent) => {
    expect(litSegments({ hp, maxHp })).toBe(segments);
    expect(percentOf({ hp, maxHp })).toBe(percent);
  });

  it('follows the hit points of the core from one frame to the next', () => {
    const family = createCore(context());
    const state = createFixtureState({ enemies: 0, projectiles: 0 });

    state.core.hp = state.core.maxHp * 0.4;
    family.update(state, 0, frameAt(0.4));
    const hurt = family.lit;
    state.core.hp = state.core.maxHp;
    family.update(state, 0, frameAt(0.4));

    expect(hurt).toBe(Math.ceil(SEGMENTS * 0.4));
    expect(family.lit).toBe(SEGMENTS);
  });

  it('turns pink and warns that the scene weakens under a quarter of its life', () => {
    const ctx = context();
    const family = createCore(ctx);
    const state = createFixtureState({ enemies: 0, projectiles: 0 });
    const frame = frameAt(0.4);
    const tintsWith = (share: number) => {
      state.core.hp = state.core.maxHp * share;
      family.update(state, 0, frame);
      return ctx.layers.core.children
        .filter((child) => child.visible)
        .map((child) => (child as unknown as { tint: number }).tint);
    };

    const healthy = tintsWith(LOW_SHARE);
    const weak = tintsWith(LOW_SHARE - 0.01);

    expect(weak).toHaveLength(healthy.length + 2);
    expect(healthy).not.toContain(frame.palette.mage);
    expect(weak).toContain(frame.palette.mage);
  });

  it('blinks the lost segment twice per beat for two beats, never in calm mode', () => {
    const half = TICKS_PER_BEAT / 2;

    const blinks = [0, half, 2 * half, 3 * half, 4 * half].map((since) =>
      lostSegmentShown(since, false),
    );

    expect(blinks).toEqual([true, false, true, false, false]);
    expect(lostSegmentShown(0, true)).toBe(false);
  });

  it.each(MOMENTS)('keeps its labels readable on their backing at %f', (fraction) => {
    const { palette } = frameAt(fraction);

    expect(contrast(palette.texte, palette.sol)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.mage, palette.sol)).toBeGreaterThanOrEqual(4.5);
  });

  it('wears dark outlines on the ring and the star only by day', () => {
    const ctx = context();
    const family = createCore(ctx);
    const state = createFixtureState({ enemies: 0, projectiles: 0 });

    family.update(state, 0, frameAt(0.4));
    const atNight = ctx.layers.core.children.filter((child) => child.visible).length;
    family.update(state, 0, frameAt(1));
    const byDay = ctx.layers.core.children.filter((child) => child.visible).length;

    expect(byDay).toBe(atNight + 2);
  });
});

describe('traps', () => {
  it.each(MOMENTS)('take the color of their effect from the palette at %f', (fraction) => {
    const ctx = context();
    const frame = frameAt(fraction);
    const state = createFixtureState({ enemies: 0, projectiles: 0, showcase: true });

    createTraps(ctx).update(state, 0, frame);

    const bodies = ctx.layers.traps.children.filter((child) => child.visible);
    const kinds = new Set(
      state.traps.map((trap) => {
        const def = FIXTURE_CONTENT.traps.find((candidate) => candidate.id === trap.kind);
        return def?.effect.kind;
      }),
    );
    expect(kinds.size).toBe(5);
    const tints = new Set(bodies.map((body) => (body as unknown as { tint: number }).tint));
    for (const kind of kinds) {
      if (kind !== undefined) {
        expect(tints).toContain(frame.palette[TRAP_TOKENS[kind]]);
      }
    }
  });

  it('shows the level as that many pips on the outline', () => {
    const ctx = context();
    const state = createFixtureState({ enemies: 0, projectiles: 0 });
    const [first] = state.traps;
    if (first === undefined) {
      throw new Error('Fixture has no trap');
    }
    first.level = 3;
    state.traps = [first];

    createTraps(ctx).update(state, 0, frameAt(0.4));

    const pips = ctx.layers.traps.children.slice(-5);
    expect(pips.filter((pip) => pip.visible)).toHaveLength(3);
  });
});

describe('pickups', () => {
  it.each(MOMENTS)('sparkle in gold for vibes and turquoise for watts at %f', (fraction) => {
    const ctx = context();
    const frame = frameAt(fraction);
    const state = createFixtureState({ enemies: 0, projectiles: 0 });
    const vibes = state.pickups.find((pickup) => pickup.kind === 'vibes');
    const watts = state.pickups.find((pickup) => pickup.kind === 'watts');
    if (vibes === undefined || watts === undefined) {
      throw new Error('Fixture lacks a kind of pickup');
    }
    state.pickups = [vibes, watts];

    createPickups(ctx).update(state, 0, frame);

    const bodies = ctx.layers.pickups.children.filter((_, index) => index % 2 === 1);
    expect(bodies.map((body) => (body as unknown as { tint: number }).tint)).toEqual([
      frame.palette.or,
      frame.palette.turquoise,
    ]);
  });
});
