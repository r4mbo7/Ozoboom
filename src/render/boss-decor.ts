import { type Container, Sprite, Texture } from 'pixi.js';
import { SHADE_DEEP, TAU, WHITE, circle, paint, polygon, type Shape } from './paint';
import type { Particles } from './effects';
import type { Frame } from './frame';
import { setTint } from './util';

const SPLINTER_BEATS = 0.7;

export interface BossDecor {
  // A soft black disc: squashed into the shadow a boss casts.
  readonly shadow: Shape;
  // A dark splinter with a pale edge, flying off a hit boss.
  readonly splinter: Shape;
  readonly relic: Shape;
  // The flower of life a relic floats in.
  readonly flower: Shape;
  // A thin ring, for the wave of a landing and the burst of a farewell.
  readonly ring: Shape;
}

export function createBossDecor(): BossDecor {
  return {
    shadow: paint(128, 128, 56, (ctx) => {
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 64);
      gradient.addColorStop(0, WHITE);
      gradient.addColorStop(0.8, WHITE);
      gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
      ctx.fillStyle = gradient;
      circle(ctx, 64);
      ctx.fill();
    }),
    splinter: paint(24, 24, 8, (ctx) => {
      polygon(ctx, [
        [-7, -4],
        [7, -1.5],
        [-1.5, 7],
      ]);
      ctx.fillStyle = SHADE_DEEP;
      ctx.fill();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
    }),
    relic: paint(48, 48, 12, (ctx) => {
      ctx.shadowColor = WHITE;
      ctx.shadowBlur = 10;
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-12, -12, 24, 24);
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3.6;
      ctx.strokeStyle = WHITE;
      ctx.strokeRect(-12, -12, 24, 24);
      circle(ctx, 4.5);
      ctx.fillStyle = WHITE;
      ctx.fill();
    }),
    ring: paint(256, 256, 120, (ctx) => {
      ctx.shadowColor = WHITE;
      ctx.shadowBlur = 6;
      ctx.lineWidth = 3;
      ctx.strokeStyle = WHITE;
      circle(ctx, 120);
      ctx.stroke();
    }),
    flower: paint(96, 96, 40, (ctx) => {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = WHITE;
      for (let index = 0; index < 6; index += 1) {
        const angle = (index / 6) * TAU;
        circle(ctx, 20, Math.cos(angle) * 20, Math.sin(angle) * 20);
        ctx.stroke();
      }
    }),
  };
}

// In boss radii: the shadow a boss casts on the ground, below and a little aside.
const SHADOW = { x: 0.1, y: 1.1, width: 1, height: 0.28, alpha: 0.4 };

export function place(
  sprite: Sprite,
  x: number,
  y: number,
  rotation: number,
  scaleX: number,
  scaleY = scaleX,
): void {
  sprite.visible = true;
  sprite.position.set(x, y);
  sprite.rotation = rotation;
  sprite.scale.set(scaleX, scaleY);
}

// `x` and `y` stand on the ground, under the mask however high it hops.
export function placeShadow(
  sprite: Sprite,
  decor: BossDecor,
  x: number,
  y: number,
  radius: number,
  strength: number,
): void {
  place(
    sprite,
    x + SHADOW.x * radius,
    y + SHADOW.y * radius,
    0,
    (SHADOW.width * radius) / decor.shadow.radius,
    (SHADOW.height * radius) / decor.shadow.radius,
  );
  setTint(sprite, 0x000000);
  sprite.alpha = SHADOW.alpha * strength;
}

const DIM_MARGIN = 4000;

// The black veil the floor darkens under before a boss lands, over the arena and well beyond it.
export function createDim(
  parent: Container,
): (shade: number, arena: { readonly width: number; readonly height: number }) => void {
  const dim = new Sprite(Texture.WHITE);
  dim.tint = 0x000000;
  dim.visible = false;
  parent.addChild(dim);
  return (shade, arena) => {
    dim.visible = shade > 0;
    dim.alpha = shade;
    dim.position.set(-DIM_MARGIN, -DIM_MARGIN);
    dim.width = arena.width + 2 * DIM_MARGIN;
    dim.height = arena.height + 2 * DIM_MARGIN;
  };
}

export function destroyBossDecor(decor: BossDecor): void {
  for (const shape of [decor.shadow, decor.splinter, decor.relic, decor.flower, decor.ring]) {
    shape.texture.destroy(true);
  }
}

// Dark splinters with a pale edge, fanning out from `angle` and falling.
export function splinter(
  splinters: Particles,
  at: { x: number; y: number },
  angle: number,
  spread: number,
  reach: number,
  count: number,
  frame: Frame,
  seed: number,
): void {
  for (let index = 0; index < count; index += 1) {
    const turn = angle + (((seed * 0.618 + index * 0.37) % 1) - 0.5) * spread;
    const far = reach * (0.5 + ((seed + index * 7) % 5) * 0.25);
    splinters.spawn({
      now: frame.now,
      duration: SPLINTER_BEATS * frame.tempo.ticksPerBeat,
      x: at.x,
      y: at.y,
      dx: Math.cos(turn) * far,
      dy: Math.sin(turn) * far + reach * 0.5,
      fromRadius: 5 + (index % 3) * 1.5,
      toRadius: 3.5,
      tint: frame.palette.badVibeRim,
      peak: 1,
      rotation: turn,
      spin: (index % 2 === 0 ? 1 : -1) * 5,
    });
  }
}
