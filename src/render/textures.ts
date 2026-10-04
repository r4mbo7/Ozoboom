import { CanvasSource, Texture } from 'pixi.js';
import type { EnemyBehaviour, TrapEffect } from '../data/types';
import { PALETTE, cssColor } from './palette';

export interface Shape {
  readonly texture: Texture;
  readonly radius: number;
}

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

export const TRAP_COLORS: Readonly<Record<TrapLook, number>> = {
  shockwave: PALETTE.uvCyan,
  beam: PALETTE.uvMagenta,
  mist: PALETTE.uvLime,
  lure: PALETTE.uvMagenta,
  strobe: PALETTE.glow,
};

const TAU = Math.PI * 2;
const WHITE = '#ffffff';

type Draw = (ctx: CanvasRenderingContext2D) => void;

function paint(width: number, height: number, radius: number, draw: Draw): Shape {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('Canvas 2D context is unavailable');
  }
  ctx.translate(width / 2, height / 2);
  draw(ctx);
  const source = new CanvasSource({ resource: canvas, autoGenerateMipmaps: true });
  return { texture: new Texture({ source }), radius };
}

function polygon(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[]) {
  ctx.beginPath();
  for (const [x, y] of points) {
    ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function circle(ctx: CanvasRenderingContext2D, radius: number, x = 0, y = 0) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
}

function star(ctx: CanvasRenderingContext2D, points: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (index / (points * 2)) * TAU - Math.PI / 2;
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
}

function glow(ctx: CanvasRenderingContext2D, color: string, blur: number) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

const ENEMY_PATHS: Readonly<
  Record<EnemyBehaviour, (ctx: CanvasRenderingContext2D, r: number) => void>
> = {
  horde: (ctx, r) => {
    circle(ctx, r);
  },
  rusher: (ctx, r) => {
    polygon(ctx, [
      [r * 1.2, 0],
      [-r * 0.8, -r * 0.9],
      [-r * 0.8, r * 0.9],
    ]);
  },
  heavy: (ctx, r) => {
    ctx.beginPath();
    ctx.roundRect(-r * 0.88, -r * 0.88, r * 1.76, r * 1.76, r * 0.12);
  },
  shooter: (ctx, r) => {
    polygon(ctx, [
      [0, -r * 1.2],
      [r * 0.8, 0],
      [0, r * 1.2],
      [-r * 0.8, 0],
    ]);
  },
  boss: (ctx, r) => {
    star(ctx, 10, r, r * 0.74);
  },
};

function enemy(behaviour: EnemyBehaviour): Shape {
  const r = behaviour === 'boss' ? 64 : 32;
  const size = r * 4;
  return paint(size, size, r, (ctx) => {
    const shadow = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.95);
    shadow.addColorStop(0, cssColor(PALETTE.night, 0.92));
    shadow.addColorStop(1, cssColor(PALETTE.night, 0));
    ctx.fillStyle = shadow;
    circle(ctx, r * 1.95);
    ctx.fill();

    const path = ENEMY_PATHS[behaviour];
    path(ctx, r);
    ctx.fillStyle = cssColor(PALETTE.badVibe);
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = r * 0.14;
    ctx.strokeStyle = cssColor(PALETTE.ink);
    ctx.stroke();

    ctx.save();
    ctx.scale(0.4, 0.4);
    path(ctx, r);
    ctx.restore();
    ctx.fillStyle = cssColor(PALETTE.ink, 0.35);
    ctx.fill();

    if (behaviour === 'boss') {
      circle(ctx, r * 0.3);
      ctx.fillStyle = cssColor(PALETTE.night);
      ctx.fill();
    }
  });
}

function trap(look: TrapLook): Shape {
  const r = 32;
  const color = cssColor(TRAP_COLORS[look]);
  return paint(r * 3, r * 3, r, (ctx) => {
    glow(ctx, color, 10);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = color;
    ctx.fillStyle = cssColor(PALETTE.ink);
    switch (look) {
      case 'shockwave':
        ctx.beginPath();
        ctx.roundRect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8, r * 0.2);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 4;
        circle(ctx, r * 0.5);
        ctx.stroke();
        break;
      case 'beam':
        ctx.fillStyle = color;
        ctx.fillRect(r * 0.3, -r * 0.2, r * 0.75, r * 0.4);
        ctx.fillStyle = cssColor(PALETTE.ink);
        circle(ctx, r * 0.68);
        ctx.fill();
        ctx.stroke();
        break;
      case 'mist':
        for (const [x, y] of [
          [-r * 0.4, r * 0.15],
          [r * 0.4, r * 0.15],
          [0, -r * 0.3],
        ] as const) {
          circle(ctx, r * 0.5, x, y);
          ctx.fill();
          ctx.stroke();
        }
        break;
      case 'lure':
        polygon(ctx, [
          [0, -r],
          [r * 0.87, r * 0.5],
          [-r * 0.87, r * 0.5],
        ]);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 2;
        polygon(ctx, [
          [0, r * 0.5],
          [r * 0.43, -r * 0.25],
          [-r * 0.43, -r * 0.25],
        ]);
        ctx.stroke();
        break;
      case 'strobe':
        star(ctx, 8, r, r * 0.45);
        ctx.fill();
        ctx.stroke();
        break;
    }
    ctx.fillStyle = cssColor(PALETTE.glow);
    circle(ctx, r * 0.16);
    ctx.fill();
  });
}

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
      const cyan = cssColor(PALETTE.uvCyan);
      ctx.fillStyle = cssColor(PALETTE.ink);
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
      ctx.fillStyle = cssColor(PALETTE.glow);
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
      const magenta = PALETTE.uvMagenta;
      gradient.addColorStop(0, cssColor(magenta, 0));
      gradient.addColorStop(0.3, cssColor(magenta, 0.25));
      gradient.addColorStop(0.43, cssColor(magenta, 1));
      gradient.addColorStop(0.5, cssColor(PALETTE.glow));
      gradient.addColorStop(0.57, cssColor(magenta, 1));
      gradient.addColorStop(0.7, cssColor(magenta, 0.25));
      gradient.addColorStop(1, cssColor(magenta, 0));
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
      const shadow = ctx.createRadialGradient(0, 0, 4, 0, 0, 15);
      shadow.addColorStop(0, cssColor(PALETTE.night, 0.9));
      shadow.addColorStop(1, cssColor(PALETTE.night, 0));
      ctx.fillStyle = shadow;
      circle(ctx, 15);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.quadraticCurveTo(-2, -8, 6, -6);
      ctx.arc(6, 0, 6, -Math.PI / 2, Math.PI / 2);
      ctx.quadraticCurveTo(-2, 8, -10, 0);
      ctx.fillStyle = cssColor(PALETTE.badVibe);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = cssColor(PALETTE.ink);
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
