import { Container, type Renderer as PixiRenderer } from 'pixi.js';
import type { SkillEffect } from '../data/types';
import { NIGHT_END, NIGHT_START, type PaletteToken, lightAt, paletteAt } from '../shared/palette';
import type { SimState } from '../sim/state';
import { createClassEffects } from './class-effects';
import type { Family } from './context';
import { type Frame, beatFrame, createFrame } from './frame';
import { type Layers, applyLight, createLayers } from './layers';
import { fitPortraitCanvas } from './portrait-canvas';
import { portraitContext } from './portrait-context';
import { emptyState, portraitEvents, standing } from './portrait-state';
import { writePixiPalette } from './palette';
import { createPlayers } from './players';
import type { Textures } from './textures';
import { REFERENCE_RADIUS } from './textures-players';

const VIEW_UNITS = 80;
const THUMBNAIL_UNITS = 52;
const THUMBNAIL_PIXELS = 120;
// A framed still keeps this share of its frame free on each side.
const FRAMED_MARGIN = 0.08;
const CALM_PULSE = 0.3;
const MAX_CATCH_UP = 8;
export const PORTRAIT_PIXELS = 512;
export const PORTRAIT_NIGHT = (NIGHT_START + NIGHT_END) / 2;
const PALETTE = paletteAt(PORTRAIT_NIGHT);
const LIGHT = lightAt(PORTRAIT_NIGHT);

// A class standing in its own little world, drawn by the portraits' shared renderer.
export interface Scene {
  readonly stage: Container;
  readonly layers: Layers;
  readonly families: readonly Family[];
  readonly state: SimState;
  readonly frame: Frame;
  beatTick: number;
  // The renderer that last drew the scene, by its rank; 0 before any drew it.
  drawnBy: number;
}

export interface SceneArt {
  readonly textures: Textures;
  readonly tokens: ReadonlyMap<string, PaletteToken>;
  readonly skillEffects: ReadonlyMap<string, SkillEffect>;
}

export function createScene(art: SceneArt, definition: Parameters<typeof standing>[0]): Scene {
  const stage = new Container();
  const layers = createLayers(stage);
  const ctx = portraitContext(art.textures, layers, art.tokens, art.skillEffects);
  const state = emptyState(standing(definition), VIEW_UNITS);
  const frame = createFrame();
  frame.portrait = true;
  frame.fraction = PORTRAIT_NIGHT;
  frame.light = LIGHT;
  writePixiPalette(frame.palette, PALETTE);
  applyLight(layers, frame);
  const families = [createPlayers(ctx), createClassEffects(ctx, () => undefined)];
  return {
    stage,
    layers,
    families,
    state,
    frame,
    beatTick: Number.NEGATIVE_INFINITY,
    drawnBy: 0,
  };
}

function advance(scene: Scene, tick: number, effectOf: (classId: string) => SkillEffect): void {
  const { state, frame } = scene;
  const player = state.players[0];
  if (player === undefined) {
    return;
  }
  const effect = effectOf(player.classId);
  const from = Math.max(state.tick + 1, tick - MAX_CATCH_UP);
  for (let next = from; next <= tick; next += 1) {
    state.tick = next;
    if (player.invulnerableTicks !== undefined && player.invulnerableTicks > 0) {
      player.invulnerableTicks -= 1;
    }
    state.events = portraitEvents(next, player, effect);
    for (const event of state.events) {
      if (event.type === 'beat') {
        scene.beatTick = next;
      }
      for (const family of scene.families) {
        family.onEvent?.(event, state, frame);
      }
    }
  }
}

export interface SceneDraw {
  readonly scene: Scene;
  readonly canvas: HTMLCanvasElement;
  readonly renderer: PixiRenderer;
  // In ticks.
  readonly now: number;
  readonly calm: boolean;
  readonly effectOf: (classId: string) => SkillEffect;
  readonly textures: Textures | null;
  // A still that shows the whole class, figure and attack, inside its frame: the Programme's portraits.
  readonly framed?: boolean;
}

// The scene played on to `now` and copied into the canvas, at the size its frame has.
export function drawScene({
  scene,
  canvas,
  renderer,
  now,
  calm,
  effectOf,
  textures,
  framed = false,
}: SceneDraw): void {
  const { frame, layers, state } = scene;
  const fitted = fitPortraitCanvas(canvas, PORTRAIT_PIXELS);
  if (fitted === null) {
    return;
  }
  const { target, width, height } = fitted;
  const tick = Math.floor(now);
  advance(scene, tick, effectOf);
  const alpha = now - tick;
  const units = !framed && canvas.clientHeight < THUMBNAIL_PIXELS ? THUMBNAIL_UNITS : VIEW_UNITS;
  const scale = Math.min(width, height) / units;
  frame.now = now;
  frame.calm = calm;
  beatFrame(frame, now - scene.beatTick, CALM_PULSE);
  frame.camera = { centerX: 0, centerY: 0, scale, screenWidth: width, screenHeight: height };
  const player = state.players[0];
  const middle =
    player === undefined
      ? 0
      : ((textures?.players.drawings.get(player.classId)?.get().centerAhead ?? 0) * player.radius) /
        REFERENCE_RADIUS;
  layers.world.scale.set(scale);
  layers.world.position.set(
    width / 2 - (player?.aim.x ?? 0) * middle * scale,
    height / 2 - (player?.aim.y ?? 0) * middle * scale,
  );
  for (const family of scene.families) {
    family.update(state, alpha, frame);
  }
  if (framed) {
    frameAll(layers, width, height);
  }
  renderer.render({ container: scene.stage, clear: true });
  target.clearRect(0, 0, width, height);
  target.drawImage(renderer.canvas, 0, 0, width, height, 0, 0, width, height);
}

// Scales and centres the world so the class and all its attack draws fit the frame, a margin around
// them; the setting's backdrop, wider than the frame, is left out of the measure.
export function frameAll({ world, setting }: Layers, width: number, height: number): void {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const layer of world.children) {
    if (layer === setting || !layer.visible) {
      continue;
    }
    const bounds = layer.getLocalBounds();
    if (bounds.width > 0 && bounds.height > 0) {
      minX = Math.min(minX, bounds.minX + layer.x);
      minY = Math.min(minY, bounds.minY + layer.y);
      maxX = Math.max(maxX, bounds.maxX + layer.x);
      maxY = Math.max(maxY, bounds.maxY + layer.y);
    }
  }
  const drawnWidth = maxX - minX;
  const drawnHeight = maxY - minY;
  if (!(drawnWidth > 0 && drawnHeight > 0)) {
    return;
  }
  const room = 1 - 2 * FRAMED_MARGIN;
  const scale = Math.min((width * room) / drawnWidth, (height * room) / drawnHeight);
  world.scale.set(scale);
  world.position.set(
    width / 2 - ((minX + maxX) / 2) * scale,
    height / 2 - ((minY + maxY) / 2) * scale,
  );
}
