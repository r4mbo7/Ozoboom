import { Container, Sprite, type Texture } from 'pixi.js';
import { clamp01, smoothstep } from '../shared/scalar';
import { TAU, WHITE, circle, paint, type Ctx } from './paint';
import { setTint } from './util';

// A look is drawn in units where the edge of the core is at RIM.
export const RIM = 70;
export const LOOK_TEXTURE_RADIUS = 92;
const TEXTURE_SCALE = LOOK_TEXTURE_RADIUS / RIM;
const FULL_REACH = 97;
// Calm mode holds every look on this moment: nothing turns, nothing blinks.
const CALM_BEATS = 4.5;

export type LayerMove = (sprite: Sprite, beats: number) => void;

export interface CoreLayer {
  readonly draw: (ctx: Ctx) => void;
  // Half the side of its texture, in units.
  readonly reach?: number;
  // Tinted with the colour of life: what the layer draws in white takes it, its darks stay dark.
  readonly life?: boolean;
  // Adds its light by night, lies on the body by day.
  readonly light?: boolean;
  readonly move?: LayerMove;
}

export interface CoreLook {
  readonly id: string;
  readonly layers: readonly CoreLayer[];
}

export interface CoreLookView {
  readonly root: Container;
  update(beats: number, life: number, additive: boolean): void;
  destroy(): void;
}

export const DOME_LOOK: CoreLook = { id: 'dome', layers: [] };

function stageHash(setId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < setId.length; index += 1) {
    hash = Math.imul(hash ^ setId.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

// Drawn from the seed and the stage, so every player of a game, and its recording, see the same core.
export function coreLookOf(looks: readonly CoreLook[], seed: number, setId: string): CoreLook {
  return looks[(seed + stageHash(setId)) % looks.length] ?? DOME_LOOK;
}

export function lookBeats(now: number, originTick: number, ticksPerBeat: number, calm: boolean) {
  return calm ? CALM_BEATS : (now - originTick) / ticksPerBeat;
}

export function fraction(value: number): number {
  return value - Math.floor(value);
}

export function kick(beats: number, rate = 5, delay = 0): number {
  return Math.exp(-rate * fraction(beats - delay));
}

export function eased(share: number): number {
  return smoothstep(clamp01(share));
}

export function fillDisc(
  ctx: Ctx,
  radius: number,
  fill: string | CanvasGradient,
  x = 0,
  y = 0,
): void {
  circle(ctx, radius, x, y);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeDisc(
  ctx: Ctx,
  radius: number,
  stroke: string | CanvasGradient,
  width: number,
): void {
  circle(ctx, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

// The game's trait: a light line with a dark core.
export function doubleRim(ctx: Ctx, radius: number, line: string, core: string, width: number) {
  strokeDisc(ctx, radius, line, width);
  strokeDisc(ctx, radius, core, width * 0.36);
}

export function softLight(radius: number): (ctx: Ctx) => void {
  return (ctx) => {
    const light = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    light.addColorStop(0, WHITE);
    light.addColorStop(0.4, 'rgb(255 255 255 / 0.45)');
    light.addColorStop(1, 'rgb(255 255 255 / 0)');
    fillDisc(ctx, radius, light);
  };
}

export function createLookView(parent: Container, look: CoreLook): CoreLookView {
  const root = new Container();
  parent.addChild(root);
  const painted = new Map<(ctx: Ctx) => void, Texture>();
  const sprites = look.layers.map((layer) => {
    let texture = painted.get(layer.draw);
    if (texture === undefined) {
      const side = Math.ceil(2 * (layer.reach ?? FULL_REACH) * TEXTURE_SCALE);
      texture = paint(side, side, LOOK_TEXTURE_RADIUS, (ctx) => {
        ctx.scale(TEXTURE_SCALE, TEXTURE_SCALE);
        layer.draw(ctx);
      }).texture;
      painted.set(layer.draw, texture);
    }
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    root.addChild(sprite);
    return { layer, sprite };
  });

  return {
    root,
    update(beats, life, additive) {
      const mode = additive ? 'add' : 'normal';
      for (const { layer, sprite } of sprites) {
        if (layer.life === true) {
          setTint(sprite, life);
        }
        if (layer.light === true) {
          sprite.blendMode = mode;
        }
        layer.move?.(sprite, beats);
        sprite.visible = sprite.alpha > 0;
      }
    },
    destroy() {
      root.destroy({ children: true });
      for (const texture of painted.values()) {
        texture.destroy(true);
      }
    },
  };
}

export function place(sprite: Sprite, x: number, y: number): void {
  sprite.position.set(x * TEXTURE_SCALE, y * TEXTURE_SCALE);
}

export const QUARTER_TURN = TAU / 4;
