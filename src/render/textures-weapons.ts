import type { WeaponEffect } from '../data/types';
import {
  SHADE_DEEP,
  TAU,
  WHITE,
  circle,
  doubleStroke,
  glow,
  paint,
  polygon,
  type Ctx,
  type Shape,
} from './paint';

export type WeaponKind = WeaponEffect['kind'];

export interface WeaponTextures {
  // One silhouette per weapon, told by its effect kind: the sheet at 16 and 32 pixels is made of these.
  readonly icons: Readonly<Record<WeaponKind, Shape>>;
  readonly sparkShot: Shape;
  readonly swing: Shape;
  readonly swingFull: Shape;
  readonly hoopRing: Shape;
  readonly dash: Shape;
  readonly zone: Shape;
  readonly shadow: Shape;
}

export const ICON_RADIUS = 32;
export const SWING_RADIUS = 64;
export const POLE_HEIGHT = 1.8 * ICON_RADIUS;
const OUTER = 8;
const GAP = 3;

function outlined(ctx: Ctx, outer = OUTER, gap = GAP): void {
  ctx.fill();
  doubleStroke(ctx, outer, gap);
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
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
      case 'lob':
        polygon(ctx, [
          [-22, -27],
          [22, -27],
          [0, -1],
        ]);
        outlined(ctx);
        polygon(ctx, [
          [-22, 27],
          [22, 27],
          [0, 1],
        ]);
        outlined(ctx);
        break;
      case 'boomerang':
        circle(ctx, 26);
        outlined(ctx);
        circle(ctx, 11);
        doubleStroke(ctx, 6, 2.5);
        break;
      case 'plate':
        circle(ctx, 19);
        outlined(ctx);
        ctx.lineWidth = 5;
        for (const [from, to] of [
          [-1.1, -0.4],
          [2.04, 2.74],
        ] as const) {
          ctx.beginPath();
          ctx.arc(0, 0, 28, from, to);
          ctx.stroke();
        }
        ctx.fillStyle = WHITE;
        circle(ctx, 5);
        ctx.fill();
        break;
      case 'totem':
        ctx.beginPath();
        ctx.rect(-5, -POLE_HEIGHT / 2 + 6, 10, POLE_HEIGHT - 12);
        outlined(ctx, 6, 2.5);
        polygon(ctx, [
          [5, -POLE_HEIGHT / 2 + 6],
          [26, -POLE_HEIGHT / 2 + 14],
          [5, -POLE_HEIGHT / 2 + 22],
        ]);
        outlined(ctx, 5, 2);
        ctx.fillStyle = WHITE;
        polygon(ctx, [
          [0, -POLE_HEIGHT / 2 - 12],
          [7, -POLE_HEIGHT / 2 - 3],
          [0, -POLE_HEIGHT / 2 + 6],
          [-7, -POLE_HEIGHT / 2 - 3],
        ]);
        ctx.fill();
        circle(ctx, 7, 0, POLE_HEIGHT / 2 - 6);
        ctx.fill();
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

export const WEAPON_KINDS: readonly WeaponKind[] = [
  'sweep',
  'spark',
  'hoop',
  'lob',
  'boomerang',
  'plate',
  'totem',
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
  return {
    icons: Object.fromEntries(WEAPON_KINDS.map((kind) => [kind, icon(kind)])) as Record<
      WeaponKind,
      Shape
    >,
    sparkShot: paint(32, 32, 12, (ctx) => {
      glow(ctx, WHITE, 6);
      ctx.fillStyle = SHADE_DEEP;
      ctx.strokeStyle = WHITE;
      ctx.lineJoin = 'round';
      polygon(ctx, [
        [12, 0],
        [0, -6],
        [-12, 0],
        [0, 6],
      ]);
      outlined(ctx, 4.5, 1.6);
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
  for (const shape of [...Object.values(textures.icons), ...singles(textures)]) {
    shape.texture.destroy(true);
  }
}

function singles(textures: WeaponTextures): Shape[] {
  const { sparkShot, swing: arc, swingFull, hoopRing, dash, zone, shadow } = textures;
  return [sparkShot, arc, swingFull, hoopRing, dash, zone, shadow];
}
