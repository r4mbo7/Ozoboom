import type { EnemyBehaviour, TrapEffect } from '../data/types';
import type { PaletteToken } from '../shared/palette';
import {
  SHADE,
  SHADE_DEEP,
  TAU,
  WHITE,
  circle,
  glow,
  paint,
  polygon,
  star,
  type Shape,
} from './paint';
import { enemy } from './textures-enemies';
import { trap } from './textures-traps';

export type { Shape } from './paint';

export type TrapLook = TrapEffect['kind'];

export interface Textures {
  readonly halo: Shape;
  readonly ring: Shape;
  readonly shard: Shape;
  readonly streak: Shape;
  readonly vibes: Shape;
  readonly watts: Shape;
  readonly player: Shape;
  readonly playerDowned: Shape;
  readonly playerRing: Shape;
  readonly aim: Shape;
  readonly core: Shape;
  readonly coreRay: Shape;
  readonly beam: Shape;
  readonly enemyShot: Shape;
  readonly enemies: Readonly<Record<EnemyBehaviour, Shape>>;
  readonly traps: Readonly<Record<TrapLook, Shape>>;
}

export const STREAK_HEAD = 40 / 48;
export const BEAM_LENGTH = 64;

export const TRAP_TOKENS: Readonly<Record<TrapLook, PaletteToken>> = {
  shockwave: 'turquoise',
  beam: 'mage',
  mist: 'healer',
  lure: 'or',
  strobe: 'texte',
};

export function createTextures(): Textures {
  return {
    halo: paint(128, 128, 64, (ctx) => {
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 64);
      gradient.addColorStop(0, 'rgb(255 255 255 / 0.55)');
      gradient.addColorStop(0.3, 'rgb(255 255 255 / 0.24)');
      gradient.addColorStop(0.65, 'rgb(255 255 255 / 0.06)');
      gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(-64, -64, 128, 128);
    }),
    ring: paint(128, 128, 54, (ctx) => {
      glow(ctx, WHITE, 8);
      ctx.lineWidth = 5;
      ctx.strokeStyle = WHITE;
      circle(ctx, 54);
      ctx.stroke();
    }),
    shard: paint(24, 24, 10, (ctx) => {
      ctx.fillStyle = WHITE;
      polygon(ctx, [
        [0, -10],
        [4, 0],
        [0, 10],
        [-4, 0],
      ]);
      ctx.fill();
    }),
    streak: paint(48, 16, 3.5, (ctx) => {
      const gradient = ctx.createLinearGradient(-20, 0, 16, 0);
      gradient.addColorStop(0, 'rgb(255 255 255 / 0)');
      gradient.addColorStop(1, WHITE);
      ctx.lineCap = 'round';
      ctx.lineWidth = 7;
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(16, 0);
      ctx.stroke();
    }),
    vibes: paint(32, 32, 12, (ctx) => {
      glow(ctx, WHITE, 6);
      ctx.fillStyle = WHITE;
      star(ctx, 4, 12, 3.5);
      ctx.fill();
    }),
    watts: paint(32, 32, 10, (ctx) => {
      glow(ctx, WHITE, 6);
      ctx.beginPath();
      for (let index = 0; index < 6; index += 1) {
        const angle = (index / 6) * TAU;
        ctx.lineTo(Math.cos(angle) * 9, Math.sin(angle) * 9);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgb(255 255 255 / 0.45)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
    }),
    player: paint(96, 96, 32, (ctx) => {
      glow(ctx, WHITE, 10);
      ctx.fillStyle = 'rgb(255 255 255 / 0.28)';
      circle(ctx, 29);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
      ctx.fillStyle = WHITE;
      circle(ctx, 9);
      ctx.fill();
    }),
    playerRing: paint(96, 96, 32, (ctx) => {
      ctx.lineWidth = 6;
      ctx.strokeStyle = WHITE;
      circle(ctx, 29);
      ctx.stroke();
    }),
    playerDowned: paint(96, 96, 32, (ctx) => {
      ctx.fillStyle = 'rgb(255 255 255 / 0.12)';
      circle(ctx, 29);
      ctx.fill();
      ctx.setLineDash([9, 7]);
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgb(255 255 255 / 0.8)';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-9, -9);
      ctx.lineTo(9, 9);
      ctx.moveTo(9, -9);
      ctx.lineTo(-9, 9);
      ctx.stroke();
    }),
    aim: paint(32, 32, 8, (ctx) => {
      glow(ctx, WHITE, 4);
      ctx.fillStyle = WHITE;
      polygon(ctx, [
        [10, 0],
        [-6, -9],
        [-2, 0],
        [-6, 9],
      ]);
      ctx.fill();
    }),
    core: paint(256, 256, 96, (ctx) => {
      const cyan = WHITE;
      ctx.fillStyle = SHADE_DEEP;
      circle(ctx, 96);
      ctx.fill();
      glow(ctx, cyan, 18);
      ctx.lineWidth = 8;
      ctx.strokeStyle = cyan;
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      for (const turn of [0, Math.PI]) {
        polygon(
          ctx,
          [0, 1, 2].map((index) => {
            const angle = turn + (index / 3) * TAU - Math.PI / 2;
            return [Math.cos(angle) * 78, Math.sin(angle) * 78] as const;
          }),
        );
        ctx.stroke();
      }
      ctx.fillStyle = WHITE;
      for (let index = 0; index < 12; index += 1) {
        const angle = (index / 12) * TAU;
        circle(ctx, 3.5, Math.cos(angle) * 86, Math.sin(angle) * 86);
        ctx.fill();
      }
      glow(ctx, cyan, 24);
      circle(ctx, 26);
      ctx.fill();
    }),
    coreRay: paint(256, 32, 16, (ctx) => {
      const gradient = ctx.createLinearGradient(-128, 0, 128, 0);
      gradient.addColorStop(0, 'rgb(255 255 255 / 0.5)');
      gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
      ctx.fillStyle = gradient;
      polygon(ctx, [
        [-128, -3],
        [128, -15],
        [128, 15],
        [-128, 3],
      ]);
      ctx.fill();
    }),
    beam: paint(BEAM_LENGTH, 32, 16, (ctx) => {
      const gradient = ctx.createLinearGradient(0, -16, 0, 16);
      gradient.addColorStop(0, 'rgb(255 255 255 / 0)');
      gradient.addColorStop(0.3, 'rgb(255 255 255 / 0.25)');
      gradient.addColorStop(0.43, WHITE);
      gradient.addColorStop(0.5, WHITE);
      gradient.addColorStop(0.57, WHITE);
      gradient.addColorStop(0.7, 'rgb(255 255 255 / 0.25)');
      gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(-BEAM_LENGTH / 2, -16, BEAM_LENGTH, 32);
      const fade = ctx.createLinearGradient(-BEAM_LENGTH / 2, 0, BEAM_LENGTH / 2, 0);
      fade.addColorStop(0, WHITE);
      fade.addColorStop(0.8, WHITE);
      fade.addColorStop(1, 'rgb(255 255 255 / 0)');
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = fade;
      ctx.fillRect(-BEAM_LENGTH / 2, -16, BEAM_LENGTH, 32);
    }),
    enemyShot: paint(32, 32, 8, (ctx) => {
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(-2, -8, 6, -6);
      ctx.arc(6, 0, 6, -Math.PI / 2, Math.PI / 2);
      ctx.quadraticCurveTo(-2, 8, -10, 0);
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = SHADE;
      ctx.stroke();
    }),
    enemies: {
      horde: enemy('horde'),
      rusher: enemy('rusher'),
      heavy: enemy('heavy'),
      shooter: enemy('shooter'),
      boss: enemy('boss'),
    },
    traps: {
      shockwave: trap('shockwave'),
      beam: trap('beam'),
      mist: trap('mist'),
      lure: trap('lure'),
      strobe: trap('strobe'),
    },
  };
}

export function destroyTextures(textures: Textures): void {
  const shapes = [
    ...Object.values(textures).filter((value): value is Shape => 'texture' in value),
    ...Object.values(textures.enemies),
    ...Object.values(textures.traps),
  ];
  for (const shape of shapes) {
    shape.texture.destroy(true);
  }
}
