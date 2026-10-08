import type { TrapEffect } from '../data/types';
import type { PaletteToken } from '../shared/palette';
import {
  SHADE_DEEP,
  TAU,
  WHITE,
  circle,
  doubleStroke,
  glow,
  paint,
  polygon,
  star,
  type Shape,
} from './paint';
import { MASK_BODY } from './face-kit';
import { type MaskSet, createMasks } from './textures-enemies';
import { type SpecialTextures, createSpecialTextures, specialShapes } from './textures-specials';
import { type PlayerTextures, playerTextures } from './textures-players';
import { type ClassFxTextures, createClassFxTextures } from './textures-class';
import { type NameTextures, createNameTextures } from './textures-names';
import { createSpeakerShapes } from './textures-speakers';
import { trap } from './textures-traps';
import {
  type WeaponTextures,
  createWeaponTextures,
  destroyWeaponTextures,
} from './textures-weapons';

export type { Shape } from './paint';

export type TrapLook = TrapEffect['kind'];

export interface Textures {
  readonly halo: Shape;
  readonly ring: Shape;
  readonly guard: Shape;
  readonly shard: Shape;
  readonly streak: Shape;
  readonly vibes: Shape;
  readonly watts: Shape;
  readonly players: PlayerTextures;
  readonly names: NameTextures;
  readonly arrow: Shape;
  readonly core: Shape;
  readonly coreRay: Shape;
  readonly beam: Shape;
  readonly pip: Shape;
  readonly enemyShot: Shape;
  readonly stack: Shape;
  readonly zone: Shape;
  readonly sweep: Shape;
  readonly masks: MaskSet;
  readonly traps: Readonly<Record<TrapLook, Shape>>;
  readonly specials: SpecialTextures;
  readonly weapons: WeaponTextures;
  readonly classFx: ClassFxTextures;
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

type Point = readonly [number, number];
export type Facet = readonly [Point, Point, Point];

function corner(count: number, radius: number, turn: number, index: number): Point {
  const angle = turn + ((index % count) / count) * TAU - Math.PI / 2;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

// A geodesic dome seen from above, in core texture pixels: a decagon rim, a pentagon turned by a
// tenth of a turn, and a small pentagon at the top, with triangles between them.
export const DOME_FACETS: readonly Facet[] = [0, 1, 2, 3, 4].flatMap((index): Facet[] => {
  const rim = (at: number) => corner(10, 80, 0, at);
  const middle = (at: number) => corner(5, 50, TAU / 10, at);
  const top = (at: number) => corner(5, 23, 0, at);
  return [
    [rim(2 * index), rim(2 * index + 1), middle(index)],
    [rim(2 * index + 1), rim(2 * index + 2), middle(index)],
    [rim(2 * index + 2), middle(index), middle(index + 1)],
    [middle(index), middle(index + 1), top(index + 1)],
    [middle(index), top(index), top(index + 1)],
  ];
});

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
    guard: paint(128, 128, 54, (ctx) => {
      glow(ctx, WHITE, 4);
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.strokeStyle = WHITE;
      ctx.beginPath();
      ctx.arc(0, 0, 54, -0.7, 0.7);
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
    streak: paint(48, 16, 3, (ctx) => {
      const gradient = ctx.createLinearGradient(-8, 0, 16, 0);
      gradient.addColorStop(0, 'rgb(255 255 255 / 0)');
      gradient.addColorStop(1, WHITE);
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(15, 0);
      ctx.stroke();
      glow(ctx, WHITE, 5);
      ctx.fillStyle = WHITE;
      circle(ctx, 3.2, 15, 0);
      ctx.fill();
    }),
    vibes: paint(32, 32, 12, (ctx) => {
      glow(ctx, WHITE, 6);
      ctx.fillStyle = WHITE;
      star(ctx, 4, 12, 2.6);
      ctx.fill();
      circle(ctx, 3);
      ctx.fill();
    }),
    watts: paint(32, 32, 10, (ctx) => {
      glow(ctx, WHITE, 6);
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = WHITE;
      ctx.beginPath();
      for (let index = 0; index < 3; index += 1) {
        const angle = (index / 3) * Math.PI + Math.PI / 2;
        ctx.moveTo(Math.cos(angle) * 11, Math.sin(angle) * 11);
        ctx.lineTo(-Math.cos(angle) * 11, -Math.sin(angle) * 11);
      }
      ctx.stroke();
      ctx.fillStyle = WHITE;
      circle(ctx, 3.4);
      ctx.fill();
    }),
    players: playerTextures(),
    core: paint(256, 256, 96, (ctx) => {
      ctx.fillStyle = SHADE_DEEP;
      circle(ctx, 92);
      ctx.fill();
      ctx.save();
      glow(ctx, WHITE, 16);
      ctx.strokeStyle = WHITE;
      circle(ctx, 86);
      doubleStroke(ctx, 11, 4.5);
      ctx.restore();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgb(255 255 255 / 0.75)';
      ctx.beginPath();
      for (const facet of DOME_FACETS) {
        ctx.moveTo(...facet[2]);
        for (const point of facet) {
          ctx.lineTo(...point);
        }
      }
      ctx.stroke();
      ctx.fillStyle = WHITE;
      circle(ctx, 7);
      ctx.fill();
    }),
    coreRay: paint(256, 32, 16, (ctx) => {
      const gradient = ctx.createLinearGradient(-128, 0, 128, 0);
      gradient.addColorStop(0, 'rgb(255 255 255 / 0.5)');
      gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
      ctx.fillStyle = gradient;
      polygon(ctx, [
        [-128, -2],
        [128, -15],
        [128, 15],
        [-128, 2],
      ]);
      ctx.fill();
    }),
    beam: paint(BEAM_LENGTH, 32, 16, (ctx) => {
      const half = BEAM_LENGTH / 2;
      ctx.fillStyle = 'rgb(255 255 255 / 0.14)';
      ctx.fillRect(-half, -10, BEAM_LENGTH, 20);
      ctx.fillStyle = WHITE;
      for (const y of [-10, 10]) {
        ctx.fillRect(-half, y - 1.5, BEAM_LENGTH, 3);
      }
      ctx.fillRect(-half, -2, BEAM_LENGTH, 4);
      const fade = ctx.createLinearGradient(-half, 0, half, 0);
      fade.addColorStop(0, WHITE);
      fade.addColorStop(0.8, WHITE);
      fade.addColorStop(1, 'rgb(255 255 255 / 0)');
      ctx.globalCompositeOperation = 'destination-in';
      ctx.fillStyle = fade;
      ctx.fillRect(-half, -16, BEAM_LENGTH, 32);
    }),
    pip: paint(16, 8, 4, (ctx) => {
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = WHITE;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.stroke();
    }),
    enemyShot: paint(32, 32, 8, (ctx) => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.lineTo(8, 0);
      ctx.stroke();
      ctx.strokeStyle = MASK_BODY;
      ctx.lineWidth = 3;
      ctx.stroke();
    }),
    names: createNameTextures(),
    arrow: paint(48, 48, 14, (ctx) => {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.fillStyle = WHITE;
      polygon(ctx, [
        [14, 0],
        [-9, -12],
        [-3, 0],
        [-9, 12],
      ]);
      ctx.fill();
    }),
    ...createSpeakerShapes(),
    masks: createMasks(),
    traps: {
      shockwave: trap('shockwave'),
      beam: trap('beam'),
      mist: trap('mist'),
      lure: trap('lure'),
      strobe: trap('strobe'),
    },
    specials: createSpecialTextures(),
    weapons: createWeaponTextures(),
    classFx: createClassFxTextures(),
  };
}

export function destroyTextures(textures: Textures): void {
  const shapes = [
    ...Object.values(textures).filter((value): value is Shape => 'texture' in value),
    ...Object.values(textures.traps),
    textures.classFx.trail,
    textures.classFx.mandala,
    ...specialShapes(textures.specials),
  ];
  for (const shape of shapes) {
    shape.texture.destroy(true);
  }
  textures.players.source.destroy();
  textures.masks.destroy();
  textures.names.destroy();
  destroyWeaponTextures(textures.weapons);
}
