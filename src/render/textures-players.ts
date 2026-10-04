import {
  SHADE,
  SHADE_DEEP,
  SHADE_SOFT,
  TAU,
  WHITE,
  circle,
  glow,
  paint,
  rim,
  type Ctx,
  type Shape,
} from './paint';
import { lyingBody, lyingObject } from './textures-players-downed';

export type PlayerLook = 'poi' | 'case' | 'parasol';

// The classes are content, their look is not: a class with no entry here fails loud in the scene.
export const PLAYER_LOOKS: Readonly<Record<string, PlayerLook>> = {
  mage: 'poi',
  tank: 'case',
  healer: 'parasol',
};

// Every player texture is drawn at the scale of REFERENCE: that many pixels are one player radius.
export const REFERENCE = 32;
export const POI_ORBIT = 46;
const POI_BALL = 9;
const CASE_HALF = { along: 15, across: 26 };
const PARASOL_RADIUS = 46;

export interface LookTextures {
  readonly object: Shape;
  readonly downed: Shape;
  // Outer reach of the object, in reference pixels: where the aim line starts and the contour sits.
  readonly extent: number;
  // How high the object is held above the ground: it stretches the shadow.
  readonly height: number;
  readonly shadow: Shape;
}

export interface PlayerTextures {
  readonly shoulders: Shape;
  readonly head: Shape;
  readonly aim: Shape;
  readonly contour: Shape;
  readonly looks: Readonly<Record<PlayerLook, LookTextures>>;
}

function shoulders(ctx: Ctx): void {
  ctx.fillStyle = SHADE_SOFT;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 24, 0, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = WHITE;
  ctx.stroke();
}

function head(ctx: Ctx): void {
  ctx.fillStyle = WHITE;
  circle(ctx, 10);
  ctx.fill();
  ctx.fillStyle = SHADE_DEEP;
  ctx.beginPath();
  ctx.arc(0, 0, 10, Math.PI / 2 - 0.35, (3 * Math.PI) / 2 + 0.35);
  ctx.closePath();
  ctx.fill();
}

function poi(ctx: Ctx): void {
  ctx.lineCap = 'round';
  for (const turn of [0, Math.PI]) {
    ctx.save();
    ctx.rotate(turn);
    // The trail lags behind the ball: the poi turn clockwise, so behind is toward negative angles.
    const steps = 10;
    for (let step = 0; step < steps; step += 1) {
      const from = -1.1 * ((step + 1) / steps);
      const to = -1.1 * (step / steps);
      const fade = 1 - step / steps;
      ctx.strokeStyle = `rgb(255 255 255 / ${String(0.9 * fade)})`;
      ctx.lineWidth = 2 + 7 * fade;
      ctx.beginPath();
      ctx.arc(0, 0, POI_ORBIT, from, to);
      ctx.stroke();
    }
    ctx.strokeStyle = SHADE;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(POI_ORBIT - POI_BALL, 0);
    ctx.stroke();
    circle(ctx, POI_BALL, POI_ORBIT, 0);
    ctx.fillStyle = WHITE;
    ctx.fill();
    rim(ctx, 2.5);
    ctx.restore();
  }
}

function flightCase(ctx: Ctx): void {
  const { along, across } = CASE_HALF;
  ctx.lineJoin = 'round';
  ctx.fillStyle = SHADE_SOFT;
  ctx.fillRect(-along, -across, along * 2, across * 2);
  rim(ctx, 3);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = SHADE;
  for (const x of [-5, 5]) {
    ctx.beginPath();
    ctx.moveTo(x, -across + 8);
    ctx.lineTo(x, across - 8);
    ctx.stroke();
  }
  ctx.fillStyle = SHADE_DEEP;
  ctx.fillRect(along - 5, -5, 5, 10);
  ctx.fillStyle = WHITE;
  const cap = 10;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.fillRect(sx > 0 ? along - cap : -along, sy > 0 ? across - cap : -across, cap, cap);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = SHADE_DEEP;
      ctx.strokeRect(sx > 0 ? along - cap : -along, sy > 0 ? across - cap : -across, cap, cap);
    }
  }
}

function parasol(ctx: Ctx): void {
  const sectors = 8;
  for (let index = 0; index < sectors; index += 1) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, PARASOL_RADIUS, (index / sectors) * TAU, ((index + 1) / sectors) * TAU);
    ctx.closePath();
    ctx.fillStyle = index % 2 === 0 ? WHITE : SHADE;
    ctx.fill();
  }
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = SHADE_DEEP;
  for (let index = 0; index < sectors; index += 1) {
    const angle = (index / sectors) * TAU;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * PARASOL_RADIUS, Math.sin(angle) * PARASOL_RADIUS);
    ctx.stroke();
  }
  circle(ctx, PARASOL_RADIUS - 1);
  rim(ctx, 3);
  circle(ctx, 5);
  ctx.fillStyle = SHADE_DEEP;
  ctx.fill();
}

function softBlob(width: number, height: number, roundness: number): Shape {
  const size = 128;
  return paint(size, size, REFERENCE, (ctx) => {
    glow(ctx, WHITE, 8);
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.roundRect(-width, -height, width * 2, height * 2, Math.min(width, height) * roundness);
    ctx.fill();
  });
}

function look(kind: PlayerLook): LookTextures {
  const size = kind === 'poi' ? 128 : kind === 'parasol' ? 112 : 96;
  const object = paint(size, size, REFERENCE, (ctx) => {
    ({ poi, case: flightCase, parasol })[kind](ctx);
  });
  const downed = paint(128, 128, REFERENCE, (ctx) => {
    lyingBody(ctx);
    lyingObject(kind, ctx);
  });
  switch (kind) {
    case 'poi':
      return {
        object,
        downed,
        extent: POI_ORBIT + POI_BALL,
        height: 1,
        shadow: softBlob(14, 24, 1),
      };
    case 'case':
      return {
        object,
        downed,
        extent: CASE_HALF.across,
        height: 1.7,
        shadow: softBlob(CASE_HALF.along, CASE_HALF.across, 0.2),
      };
    case 'parasol':
      return {
        object,
        downed,
        extent: PARASOL_RADIUS,
        height: 2.4,
        shadow: softBlob(PARASOL_RADIUS - 4, PARASOL_RADIUS - 4, 1),
      };
  }
}

export function playerTextures(): PlayerTextures {
  return {
    shoulders: paint(64, 64, REFERENCE, shoulders),
    head: paint(32, 32, REFERENCE, head),
    aim: paint(32, 8, 8, (ctx) => {
      const gradient = ctx.createLinearGradient(-12, 0, 12, 0);
      gradient.addColorStop(0, 'rgb(255 255 255 / 0.15)');
      gradient.addColorStop(1, WHITE);
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(12, 0);
      ctx.stroke();
    }),
    contour: paint(128, 128, 60, (ctx) => {
      ctx.lineWidth = 3;
      ctx.strokeStyle = WHITE;
      circle(ctx, 58);
      ctx.stroke();
    }),
    looks: { poi: look('poi'), case: look('case'), parasol: look('parasol') },
  };
}

export function playerShapes(textures: PlayerTextures): Shape[] {
  const { looks, shoulders: s, head: h, aim, contour } = textures;
  return [
    s,
    h,
    aim,
    contour,
    ...Object.values(looks).flatMap(({ object, downed, shadow }) => [object, downed, shadow]),
  ];
}
