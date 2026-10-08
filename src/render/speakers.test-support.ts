import { Container, type Graphics, type Sprite, Texture } from 'pixi.js';
import { lightAt, paletteAt } from '../shared/palette';
import type { RenderContext } from './context';
import { FIXTURE_CONTENT, createFixtureState } from './fixture';
import { layStacks } from './fixture-speakers';
import { type Frame, createFrame } from './frame';
import { createLayers } from './layers';
import { writePixiPalette } from './palette';
import type { Shape } from './textures';

export const FIXTURE_SPEAKERS = FIXTURE_CONTENT.sets[0]?.speakers ?? [];
export const BEAMS = 3;
export const PER_SPEAKER = BEAMS + 12;

export function frameAt(fraction: number, calm = false): Frame {
  const frame = createFrame();
  frame.fraction = fraction;
  frame.light = lightAt(fraction);
  frame.calm = calm;
  writePixiPalette(frame.palette, paletteAt(fraction));
  return frame;
}

export const SPEAKER_SHAPES: Readonly<Record<string, Shape>> = Object.fromEntries(
  FIXTURE_SPEAKERS.map((def) => [def.id, { texture: new Texture(), radius: 80 }]),
);

export function context() {
  const shape: Shape = { texture: Texture.EMPTY, radius: 32 };
  const set = FIXTURE_CONTENT.sets[0];
  const ctx = {
    textures: {
      halo: shape,
      ring: shape,
      speakers: SPEAKER_SHAPES,
      zone: shape,
      sweep: shape,
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

export function stateWith(poses: Parameters<typeof layStacks>[1]) {
  const state = createFixtureState({ enemies: 0, projectiles: 0 });
  layStacks(state, poses);
  return state;
}

export function bodyOf(ctx: RenderContext, index: number) {
  const body = ctx.layers.speakers.children[index * PER_SPEAKER + BEAMS + 3] as Sprite | undefined;
  if (body === undefined) {
    throw new Error('Missing speaker body');
  }
  return body;
}

export function glowOf(ctx: RenderContext, index: number) {
  const halo = ctx.layers.glow.children[index * 2 + 1] as Sprite | undefined;
  if (halo === undefined) {
    throw new Error('Missing speaker halo');
  }
  const first = index * PER_SPEAKER;
  const beams = ctx.layers.speakers.children.slice(first, first + BEAMS) as Sprite[];
  return { halo, beams };
}

export function arcOf(ctx: RenderContext, index: number) {
  return ctx.layers.speakers.children[index * PER_SPEAKER + BEAMS + 5] as Graphics;
}

export function wavesOf(ctx: RenderContext, index: number) {
  return ctx.layers.speakers.children[index * PER_SPEAKER + BEAMS + 11] as Graphics;
}

export function area(arc: Graphics): number {
  const { width, height } = arc.getLocalBounds();
  return width * height;
}
