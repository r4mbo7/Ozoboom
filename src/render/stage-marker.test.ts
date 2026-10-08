import { Container, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { lightAt, paletteAt } from '../shared/palette';
import { frameCamera } from './camera';
import type { RenderContext } from './context';
import { createFixtureState } from './fixture';
import { type Frame, createFrame } from './frame';
import { createLayers } from './layers';
import { writePixiPalette } from './palette';
import { createStageMarker } from './stage-marker';
import type { Shape } from './textures';
import { stageColor } from './vu-meter';

function context(): RenderContext {
  const shape: Shape = { texture: Texture.EMPTY, radius: 32 };
  return {
    textures: {
      halo: shape,
      arrow: shape,
      names: { get: () => ({ fill: Texture.EMPTY, edge: Texture.EMPTY }) },
    },
    layers: createLayers(new Container()),
  } as unknown as RenderContext;
}

function frameOn(
  state: ReturnType<typeof createFixtureState>,
  x: number,
  y: number,
  width = 1280,
  height = 800,
): Frame {
  const frame = createFrame();
  frame.light = lightAt(0.4);
  writePixiPalette(frame.palette, paletteAt(0.4));
  frame.camera = frameCamera({ x, y }, state.arena, width, height);
  return frame;
}

function tintsShown(ctx: RenderContext): number[] {
  return ctx.layers.screen.children
    .flatMap((child) => child.children)
    .filter((child) => child.visible)
    .map((child) => (child as unknown as { tint: number }).tint);
}

describe('stage marker', () => {
  it('shows nothing while the scene is on screen', () => {
    const ctx = context();
    const state = createFixtureState({ enemies: 0, projectiles: 0 });

    createStageMarker(ctx).update(state, 0, frameOn(state, state.core.x, state.core.y));

    expect(tintsShown(ctx)).toHaveLength(0);
  });

  it('points to the scene out of view on a phone in the color of its life', () => {
    const ctx = context();
    const state = createFixtureState({ enemies: 0, projectiles: 0 });
    const family = createStageMarker(ctx);
    const frame = frameOn(state, state.arena.width, state.core.y, 390, 844);

    family.update(state, 0, frame);
    const healthy = tintsShown(ctx);
    state.core.hp = state.core.maxHp * 0.15;
    family.update(state, 0, frame);
    const weak = tintsShown(ctx);

    expect(healthy).toContain(frame.palette.healer);
    expect(weak).toContain(stageColor(frame.palette, 0.15));
    expect(weak).not.toContain(frame.palette.healer);
    expect([...healthy, ...weak]).not.toContain(frame.palette.mage);
  });
});
