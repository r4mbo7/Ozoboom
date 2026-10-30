import type { WeaponEffect } from '../data/types';
import { recordOf } from '../shared/records';
import {
  SHADE_DEEP,
  TAU,
  WHITE,
  circle,
  doubleStroke,
  glow,
  paint,
  type Ctx,
  type Shape,
} from './paint';
import { type DevilStickTextures, createDevilStickTextures } from './textures-devil-stick';
import { createDiaboloTexture } from './textures-diabolo';
import { type PlateTextures, createPlateTextures } from './textures-plate';
import { type TotemTextures, createTotemTextures } from './textures-totem';

export type WeaponKind = WeaponEffect['kind'];

export interface WeaponTextures {
  readonly icons: Readonly<Record<WeaponKind, Shape>>;
  readonly plate: PlateTextures;
  readonly totem: TotemTextures;
  readonly devilStick: DevilStickTextures;
  readonly frisbeeStreak: Shape;
  readonly swing: Shape;
  readonly swingFull: Shape;
  readonly hoopRing: Shape;
  readonly dash: Shape;
  // The ribbon's mark: every set holds every n-th dash of one ring, each set tinted its colour.
  readonly markDashes: readonly Shape[];
  readonly zone: Shape;
  readonly shadow: Shape;
}

const ICON_RADIUS = 32;
export const FRISBEE_STREAK_LENGTH = 64;
const SWING_RADIUS = 64;
const OUTER = 8;
const GAP = 3;

function outlined(ctx: Ctx): void {
  ctx.fill();
  doubleStroke(ctx, OUTER, GAP);
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
}

const MARK_RADIUS = 54;
const MARK_DASHES = 16;
const MARK_SETS = 4;

function markDashes(set: number): Shape {
  return paint(128, 128, MARK_RADIUS, (ctx) => {
    ctx.lineCap = 'round';
    const step = TAU / MARK_DASHES;
    for (const [style, width] of [
      [SHADE_DEEP, 8],
      [WHITE, 5],
    ] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      for (let index = set; index < MARK_DASHES; index += MARK_SETS) {
        ctx.beginPath();
        ctx.arc(0, 0, MARK_RADIUS, index * step, index * step + step * 0.5);
        ctx.stroke();
      }
    }
  });
}

function icon(kind: WeaponKind): Shape {
  const r = ICON_RADIUS;
  return paint(r * 3, r * 3, r, (ctx) => {
    glow(ctx, WHITE, 6);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = WHITE;
    ctx.fillStyle = SHADE_DEEP;
    switch (kind) {
      case 'sweep':
        line(ctx, -26, 24, 12, -14);
        doubleStroke(ctx, 7, 2.5);
        circle(ctx, 11, 18, -18);
        outlined(ctx);
        ctx.fillStyle = WHITE;
        circle(ctx, 4, 18, -18);
        ctx.fill();
        circle(ctx, 5, -26, 24);
        ctx.fill();
        break;
      case 'spark':
        line(ctx, -28, -9, 28, 9);
        doubleStroke(ctx, 7, 2.5);
        for (const [x, y] of [
          [-12, 22],
          [12, -22],
        ] as const) {
          line(ctx, x, y, x * 0.2, y * 0.2);
          doubleStroke(ctx, 6, 2);
        }
        ctx.fillStyle = WHITE;
        circle(ctx, 4.5);
        ctx.fill();
        break;
      case 'hoop':
        ctx.beginPath();
        ctx.ellipse(0, 0, 28, 22, -0.5, 0, TAU);
        doubleStroke(ctx, 9, 3.5);
        break;
      case 'boomerang':
        circle(ctx, 26);
        outlined(ctx);
        ctx.save();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1.5;
        circle(ctx, 17);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = WHITE;
        for (const angle of [0, TAU / 3, (TAU * 2) / 3]) {
          circle(ctx, 3.6, Math.cos(angle) * 12, Math.sin(angle) * 12);
          ctx.fill();
        }
        break;
      case 'orbit':
        ctx.beginPath();
        ctx.moveTo(0, 26);
        ctx.arc(0, 26, 46, -Math.PI * 0.8, -Math.PI * 0.2);
        ctx.closePath();
        outlined(ctx);
        ctx.lineWidth = 4;
        for (const angle of [-0.65, -0.5, -0.35]) {
          line(ctx, 0, 26, Math.cos(angle * Math.PI) * 40, 26 + Math.sin(angle * Math.PI) * 40);
          ctx.stroke();
        }
        break;
      case 'trail':
        circle(ctx, 26);
        doubleStroke(ctx, 8, 3);
        for (let index = 0; index < 6; index += 1) {
          const angle = (index / 6) * TAU;
          line(ctx, 0, 0, Math.cos(angle) * 24, Math.sin(angle) * 24);
          ctx.lineWidth = 3.5;
          ctx.stroke();
        }
        ctx.fillStyle = WHITE;
        circle(ctx, 6);
        ctx.fill();
        break;
      case 'ribbon':
        ctx.beginPath();
        for (let step = 0; step <= 24; step += 1) {
          const x = -30 + (step / 24) * 60;
          ctx.lineTo(x, Math.sin((step / 24) * TAU * 1.5) * 13);
        }
        doubleStroke(ctx, 8, 3);
        ctx.fillStyle = WHITE;
        circle(ctx, 6, -30, 0);
        ctx.fill();
        break;
    }
  });
}

// The weapons drawn as one icon tinted with their class; the plate and the totem have their own drawing.
export const ICON_KINDS: readonly Exclude<WeaponKind, 'plate' | 'totem' | 'lob'>[] = [
  'sweep',
  'spark',
  'hoop',
  'boomerang',
  'orbit',
  'trail',
  'ribbon',
];

function swing(full: boolean): Shape {
  const r = SWING_RADIUS;
  const half = full ? Math.PI : Math.PI / 3;
  return paint(r * 2 + 16, r * 2 + 16, r, (ctx) => {
    glow(ctx, WHITE, 8);
    ctx.fillStyle = 'rgb(255 255 255 / 0.3)';
    ctx.beginPath();
    if (full) {
      ctx.arc(0, 0, r, 0, TAU);
      ctx.moveTo(r * 0.55, 0);
      ctx.arc(0, 0, r * 0.55, 0, TAU, true);
    } else {
      ctx.arc(0, 0, r, -half, half);
      ctx.arc(0, 0, r * 0.55, half, -half, true);
      ctx.closePath();
    }
    ctx.fill('evenodd');
    ctx.strokeStyle = WHITE;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, r - 3, -half, half);
    doubleStroke(ctx, 9, 3);
  });
}

export function createWeaponTextures(): WeaponTextures {
  const plate = createPlateTextures();
  const totem = createTotemTextures();
  return {
    icons: {
      ...recordOf(ICON_KINDS, icon),
      lob: createDiaboloTexture(),
      plate: plate.dish,
      totem: totem.body,
    },
    plate,
    totem,
    devilStick: createDevilStickTextures(),
    frisbeeStreak: paint(FRISBEE_STREAK_LENGTH, 72, 26, (ctx) => {
      ctx.fillStyle = 'rgb(255 255 255 / 0.08)';
      ctx.fillRect(-FRISBEE_STREAK_LENGTH / 2, -23, FRISBEE_STREAK_LENGTH, 46);
      glow(ctx, WHITE, 6);
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = 3;
      for (const edge of [-23, 23]) {
        line(ctx, -FRISBEE_STREAK_LENGTH / 2, edge, FRISBEE_STREAK_LENGTH / 2, edge);
        ctx.stroke();
      }
    }),
    swing: swing(false),
    swingFull: swing(true),
    hoopRing: paint(160, 160, 60, (ctx) => {
      glow(ctx, WHITE, 8);
      ctx.strokeStyle = WHITE;
      circle(ctx, 60);
      doubleStroke(ctx, 7, 2.8);
    }),
    dash: paint(128, 128, 54, (ctx) => {
      ctx.strokeStyle = WHITE;
      ctx.lineCap = 'round';
      ctx.lineWidth = 5;
      ctx.setLineDash([10, 9]);
      circle(ctx, 54);
      ctx.stroke();
    }),
    markDashes: Array.from({ length: MARK_SETS }, (_, set) => markDashes(set)),
    zone: paint(256, 256, 120, (ctx) => {
      ctx.strokeStyle = WHITE;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.6;
      ctx.setLineDash([16, 14]);
      circle(ctx, 120);
      ctx.stroke();
    }),
    shadow: paint(64, 64, 24, (ctx) => {
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 24);
      gradient.addColorStop(0, 'rgb(0 0 0 / 0.55)');
      gradient.addColorStop(1, 'rgb(0 0 0 / 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(-32, -32, 64, 64);
    }),
  };
}

export function destroyWeaponTextures(textures: WeaponTextures): void {
  const { glint, rim, gilt } = textures.plate;
  const { eye, cone, bass, pull, dissolve } = textures.totem;
  const { stick, sparkHead, sparkTrail, nick } = textures.devilStick;
  for (const shape of [
    ...Object.values(textures.icons),
    ...singles(textures),
    ...textures.markDashes,
    stick,
    sparkHead,
    sparkTrail,
    nick,
    glint,
    rim,
    gilt,
    eye,
    cone,
    bass,
    pull,
    ...dissolve,
  ]) {
    shape.texture.destroy(true);
  }
}

function singles(textures: WeaponTextures): Shape[] {
  const { frisbeeStreak, swing: arc, swingFull, hoopRing, dash, zone, shadow } = textures;
  return [frisbeeStreak, arc, swingFull, hoopRing, dash, zone, shadow];
}
