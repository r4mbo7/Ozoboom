import { Container, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { lightAt, paletteAt } from '../shared/palette';
import type { RenderContext } from './context';
import { createFixtureState } from './fixture';
import { type Frame, createFrame } from './frame';
import { applyLight, createLayers } from './layers';
import { writePixiPalette } from './palette';
import { createPlayers } from './players';
import type { Shape } from './textures';

const MOMENTS = [
  ['crepuscule', 0, true],
  ['nuit', 0.4, true],
  ['aube', 0.85, false],
  ['jour', 1, false],
] as const;

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
    textures: { halo: shape, playerRing: shape, player: shape, playerDowned: shape, aim: shape },
    layers: createLayers(new Container()),
    options: { calmMode: false },
    classTokens: new Map([['mage', 'mage']]),
    behaviours: new Map(),
    trapLooks: new Map(),
  } as unknown as RenderContext;
}

describe('light rule', () => {
  it.each(MOMENTS)('blends halos and trails at %s', (_moment, fraction, additive) => {
    const layers = createLayers(new Container());

    applyLight(layers, frameAt(fraction));

    expect(layers.glow.blendMode).toBe(additive ? 'add' : 'normal');
    expect(layers.fx.blendMode).toBe(additive ? 'add' : 'normal');
  });

  it('switches back to additive when the light goes down again', () => {
    const layers = createLayers(new Container());

    applyLight(layers, frameAt(1));
    applyLight(layers, frameAt(0.4));

    expect(layers.glow.blendMode).toBe('add');
  });
});

describe('players', () => {
  it.each(MOMENTS)(
    'tint the class color and outline only by day at %s',
    (_moment, fraction, night) => {
      const ctx = context();
      const players = createPlayers(ctx);
      const frame = frameAt(fraction);
      const state = createFixtureState({ enemies: 0, projectiles: 0 });

      players.update(state, 0, frame);

      const sprites = ctx.layers.glow.children.concat(ctx.layers.players.children);
      const [halo] = ctx.layers.glow.children;
      const [outline, body] = ctx.layers.players.children;
      expect(sprites.length).toBeGreaterThan(0);
      expect(body?.tint).toBe(frame.palette.mage);
      expect(halo?.tint).toBe(frame.palette.mage);
      expect(halo?.alpha).toBe(frame.light.haloAlpha);
      expect(outline?.visible).toBe(!night);
    },
  );

  it('outline by day with the text color of the moment', () => {
    const ctx = context();
    const frame = frameAt(1);

    createPlayers(ctx).update(createFixtureState({ enemies: 0, projectiles: 0 }), 0, frame);

    expect(ctx.layers.players.children[0]?.tint).toBe(frame.palette.texte);
  });
});
