import { Container, type Graphics, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { lightAt, paletteAt } from '../shared/palette';
import { TICKS_PER_BAR } from '../shared/tempo';
import type { RenderContext } from './context';
import { FIXTURE_CONTENT, createFixtureState } from './fixture';
import { layStacks } from './fixture-speakers';
import { type Frame, createFrame } from './frame';
import { createLayers } from './layers';
import { writePixiPalette } from './palette';
import { SPEAKER_TOKENS, mixColor, plugShare, speakerToken } from './speaker-kit';
import { createSpeakers } from './speakers';
import type { Shape } from './textures';

const FIXTURE_SPEAKERS = FIXTURE_CONTENT.sets[0]?.speakers ?? [];

function frameAt(fraction: number, calm = false): Frame {
  const frame = createFrame();
  frame.fraction = fraction;
  frame.light = lightAt(fraction);
  frame.calm = calm;
  writePixiPalette(frame.palette, paletteAt(fraction));
  return frame;
}

function context() {
  const shape: Shape = { texture: Texture.EMPTY, radius: 32 };
  const set = FIXTURE_CONTENT.sets[0];
  const ctx = {
    textures: {
      halo: shape,
      ring: shape,
      stack: shape,
      zone: shape,
      traps: { shockwave: shape, beam: shape, mist: shape, lure: shape, strobe: shape },
    },
    layers: createLayers(new Container()),
    options: { calmMode: false },
    classTokens: new Map(),
    behaviours: new Map(),
    trapLooks: new Map(),
    speakerLooks: new Map([[set?.id ?? '', new Map(FIXTURE_SPEAKERS.map((def) => [def.id, def]))]]),
  } as unknown as RenderContext;
  return ctx;
}

function stateWith(poses: Parameters<typeof layStacks>[1]) {
  const state = createFixtureState({ enemies: 0, projectiles: 0 });
  layStacks(state, poses);
  return state;
}

function bodyOf(ctx: RenderContext, index: number) {
  const body = ctx.layers.speakers.children[index * 11 + 3];
  if (body === undefined) {
    throw new Error('Missing speaker body');
  }
  return body;
}

function arcOf(ctx: RenderContext, index: number) {
  return ctx.layers.speakers.children[index * 11 + 5] as Graphics;
}

function area(arc: Graphics): number {
  const { width, height } = arc.getLocalBounds();
  return width * height;
}

describe('plug ring share', () => {
  it.each([
    [0, 2, 0],
    [12, 2, 0.125],
    [TICKS_PER_BAR, 2, 0.5],
    [TICKS_PER_BAR * 2, 2, 1],
    [TICKS_PER_BAR * 3, 2, 1],
    [30, 3, 30 / (3 * TICKS_PER_BAR)],
  ])('reads %i ticks of %i bars as %f', (plugTicks, plugBars, share) => {
    expect(plugShare(plugTicks, plugBars)).toBeCloseTo(share);
  });

  it('follows plugTicks over plugBars bars on the ring that is drawn', () => {
    const ctx = context();
    const family = createSpeakers(ctx);
    const state = stateWith(['plugging', 'off', 'off', 'off']);
    const speaker = state.speakers?.[0];
    if (speaker === undefined) {
      throw new Error('Missing speaker');
    }

    speaker.plugTicks = TICKS_PER_BAR / 2;
    family.update(state, 0, frameAt(0.4));
    const quarter = area(arcOf(ctx, 0));
    speaker.plugTicks = TICKS_PER_BAR;
    family.update(state, 0, frameAt(0.4));
    const half = area(arcOf(ctx, 0));
    speaker.plugTicks = TICKS_PER_BAR * 2 - 1;
    family.update(state, 0, frameAt(0.4));
    const nearlyFull = area(arcOf(ctx, 0));

    expect(arcOf(ctx, 0).visible).toBe(true);
    expect(quarter).toBeLessThan(half);
    expect(half).toBeLessThan(nearlyFull);
  });

  it('shows no ring on an unplugged speaker nobody stands at, nor on a plugged one', () => {
    const ctx = context();
    createSpeakers(ctx).update(stateWith(['off', 'plugged', 'off', 'off']), 0, frameAt(0.4));

    expect(arcOf(ctx, 0).visible).toBe(false);
    expect(arcOf(ctx, 1).visible).toBe(false);
  });
});

describe('speaker colors', () => {
  it.each([
    ['dome-chill', 'healer'],
    ['foret', 'turquoise'],
    ['sub', 'or'],
    ['cercle-acid', 'mage'],
  ] as const)('takes the color of %s from its identifier: %s', (id, token) => {
    expect(speakerToken(id)).toBe(token);
  });

  it('refuses a speaker it has no color for', () => {
    expect(() => speakerToken('inconnue')).toThrow('inconnue');
    expect(Object.keys(SPEAKER_TOKENS)).toHaveLength(4);
  });

  it.each([0.4, 1])('tints each plugged stack in its own color at %f', (fraction) => {
    const ctx = context();
    const frame = frameAt(fraction);

    createSpeakers(ctx).update(stateWith(['plugged', 'plugged', 'plugged', 'plugged']), 0, frame);

    expect(
      FIXTURE_SPEAKERS.map((def, index) => [def.id, bodyOf(ctx, index).tint] as const),
    ).toEqual(FIXTURE_SPEAKERS.map((def) => [def.id, frame.palette[speakerToken(def.id)]]));
  });

  it('keeps an unplugged stack gray, lighter than a bad vibe, whatever its identifier', () => {
    const ctx = context();
    const frame = frameAt(0.4);

    createSpeakers(ctx).update(stateWith(['off', 'off', 'off', 'off']), 0, frame);

    for (const [index] of FIXTURE_SPEAKERS.entries()) {
      expect(bodyOf(ctx, index).tint).toBe(
        mixColor(frame.palette.badVibe, frame.palette.texte, 0.35),
      );
    }
  });
});

describe('light rule and calm mode', () => {
  it.each([
    [0.4, false],
    [1, true],
  ])('outlines the stacks only by day at %f', (fraction, outlined) => {
    const ctx = context();

    createSpeakers(ctx).update(stateWith(['off', 'off', 'off', 'off']), 0, frameAt(fraction));

    expect(ctx.layers.speakers.children[2]?.visible).toBe(outlined);
  });

  it('shivers while plugging, and holds still in calm mode', () => {
    const state = stateWith(['plugging', 'off', 'off', 'off']);
    const still = FIXTURE_SPEAKERS[0];
    const positions = (calm: boolean) => {
      const ctx = context();
      const frame = frameAt(0.4, calm);
      frame.now = 7.3;
      createSpeakers(ctx).update(state, 0, frame);
      return bodyOf(ctx, 0).position;
    };

    expect(positions(false).x).not.toBe(still?.x);
    expect(positions(true).x).toBe(still?.x);
    expect(positions(true).y).toBe(still?.y);
  });

  it('lights the cable only once the speaker is plugged', () => {
    const ctx = context();
    createSpeakers(ctx).update(stateWith(['plugged', 'off', 'off', 'off']), 0, frameAt(0.4));

    expect(ctx.layers.glow.children[0]?.visible).toBe(true);
    expect(ctx.layers.glow.children[2]?.visible).toBe(false);
  });

  it('throws on a speaker the set does not define', () => {
    const ctx = context();
    const state = stateWith(['off', 'off', 'off', 'off']);
    state.setId = 'unknown-set';

    expect(() => {
      createSpeakers(ctx).update(state, 0, frameAt(0.4));
    }).toThrow('unknown-set');
  });
});

describe('speakerPlugged flash', () => {
  it('bursts from the speaker for a beat, and never past three times its radius', () => {
    const ctx = context();
    const family = createSpeakers(ctx);
    const state = stateWith(['plugged', 'off', 'off', 'off']);
    state.tick = 100;
    state.events = [{ type: 'speakerPlugged', speakerId: 'dome-chill' }];
    family.onEvent?.(state.events[0] ?? { type: 'gameWon' }, state, frameAt(0.4));
    const frame = frameAt(0.4);

    frame.now = 100.5;
    family.update(state, 0, frame);
    const flash = ctx.layers.fx.children[2];
    expect(flash?.visible).toBe(true);
    expect((flash?.scale.x ?? 0) * 32).toBeLessThanOrEqual((FIXTURE_SPEAKERS[0]?.radius ?? 0) * 3);

    frame.now = 130;
    family.update(state, 0, frame);
    expect(flash?.visible).toBe(false);
  });
});
