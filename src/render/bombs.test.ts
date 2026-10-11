import { Container, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { lightAt, paletteAt } from '../shared/palette';
import { createBombs, farthestCorner } from './bombs';
import type { RenderContext } from './context';
import { createFixtureState } from './fixture';
import { type Frame, createFrame } from './frame';
import { createLayers } from './layers';
import { writePixiPalette } from './palette';
import type { Shape } from './textures';

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
    textures: { halo: shape, ring: shape, vibes: shape, bomb: shape },
    layers: createLayers(new Container()),
    options: { calmMode: false },
  } as unknown as RenderContext;
}

function bombState() {
  const state = createFixtureState({ enemies: 1, projectiles: 0 });
  const [carrier] = state.enemies;
  if (carrier === undefined) {
    throw new Error('Fixture has no enemy');
  }
  carrier.carriesBomb = true;
  state.bombs = [{ id: 900, ticksLeft: 1000, x: 300, y: 300, prevX: 300, prevY: 300 }];
  return state;
}

const tints = (layer: Container) =>
  layer.children
    .filter((child) => child.visible)
    .map((sprite) => (sprite as unknown as { tint: number }).tint);

describe('bombs', () => {
  it('lie in magenta with a golden spark, and float in magenta over their carrier', () => {
    const ctx = context();
    const frame = frameAt(0.4);

    createBombs(ctx).update(bombState(), 0, frame);

    expect(tints(ctx.layers.pickups)).toEqual([frame.palette.mage, frame.palette.or]);
    expect(tints(ctx.layers.bubbles)).toEqual([
      frame.palette.mage,
      frame.palette.mage,
      frame.palette.or,
    ]);
    expect(tints(ctx.layers.glow)).toEqual([frame.palette.mage, frame.palette.mage]);
  });

  it('send their wave to the farthest corner of the floor', () => {
    expect(farthestCorner({ width: 1600, height: 1000 }, 400, 200)).toBeCloseTo(
      Math.sqrt(1200 * 1200 + 800 * 800),
    );
  });

  it('flash where they go off, but never in calm mode', () => {
    const lively = context();
    const calm = context();
    const frame = frameAt(0.4);
    const state = { ...bombState(), bombs: [], enemies: [] };
    const explosion = { type: 'bombExploded', id: 900, playerId: 0, x: 300, y: 300 } as const;

    const bright = createBombs(lively);
    const soft = createBombs(calm);
    bright.onEvent?.(explosion, state, frame);
    soft.onEvent?.(explosion, state, { ...frame, calm: true });
    bright.update(state, 0, { ...frame, now: state.tick + 4 });
    soft.update(state, 0, { ...frame, now: state.tick + 4, calm: true });

    expect(tints(lively.layers.glow)).toEqual([frame.palette.mage]);
    expect(tints(calm.layers.glow)).toEqual([]);
  });
});
