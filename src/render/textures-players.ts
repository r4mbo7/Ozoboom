import type { TextureSource } from 'pixi.js';
import {
  SHADE,
  SHADE_DEEP,
  SHADE_SOFT,
  TAU,
  WHITE,
  circle,
  glow,
  paintSheet,
  rim,
  type Ctx,
  type Piece,
  type Shape,
} from './paint';
import { lyingBody, lyingObject } from './textures-players-downed';
import {
  BAG_PIECES,
  POI_BALL,
  POI_ORBIT,
  PARASOL_PIECES,
  POI_PIECES,
  REFERENCE,
  type BagParts,
  type ParasolParts,
  type PoiParts,
} from './textures-looks';

export { REFERENCE } from './textures-looks';

export type PlayerLook = 'poi' | 'bag' | 'parasol';

// The classes are content, their look is not: a class with no entry here fails loud in the scene.
export const PLAYER_LOOKS: Readonly<Record<string, PlayerLook>> = {
  mage: 'poi',
  tank: 'bag',
  healer: 'parasol',
};

const BAG_REACH = 30;
export const PARASOL_RADIUS = 46;
const PARASOL_REACH = 56;

export interface LookTextures {
  // The object drawn whole, for the looks that do not move its parts on their own.
  readonly object?: Shape;
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
  readonly poi: PoiParts;
  readonly bag: BagParts;
  readonly parasol: ParasolParts;
  // The one source under every texture above, destroyed once.
  readonly source: TextureSource;
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

function softBlob(width: number, height: number, roundness: number): Piece {
  return [
    128,
    128,
    REFERENCE,
    (ctx) => {
      glow(ctx, WHITE, 8);
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.roundRect(-width, -height, width * 2, height * 2, Math.min(width, height) * roundness);
      ctx.fill();
    },
  ];
}

function downed(kind: PlayerLook): Piece {
  return [
    128,
    128,
    REFERENCE,
    (ctx) => {
      lyingBody(ctx);
      lyingObject(kind, ctx);
    },
  ];
}

const PIECES = {
  shoulders: [64, 64, REFERENCE, shoulders],
  head: [32, 32, REFERENCE, head],
  aim: [
    32,
    8,
    8,
    (ctx) => {
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
    },
  ],
  contour: [
    128,
    128,
    60,
    (ctx) => {
      ctx.lineWidth = 3;
      ctx.strokeStyle = WHITE;
      circle(ctx, 58);
      ctx.stroke();
    },
  ],
  poiDowned: downed('poi'),
  poiShadow: softBlob(14, 24, 1),
  bagDowned: downed('bag'),
  bagShadow: softBlob(26, 28, 1),
  parasol: [112, 112, REFERENCE, parasol],
  parasolDowned: downed('parasol'),
  parasolShadow: softBlob(PARASOL_RADIUS - 4, PARASOL_RADIUS - 4, 1),
  ...POI_PIECES,
  ...BAG_PIECES,
  ...PARASOL_PIECES,
} satisfies Record<string, Piece>;

// Every texture of the players is one cell of a single sheet: whatever the class of who is on
// screen, their sprites are drawn in one batch.
export function playerTextures(): PlayerTextures {
  const { shapes: t, source } = paintSheet(PIECES);
  return {
    shoulders: t.shoulders,
    head: t.head,
    aim: t.aim,
    contour: t.contour,
    looks: {
      poi: { downed: t.poiDowned, extent: POI_ORBIT + POI_BALL, height: 1, shadow: t.poiShadow },
      bag: { downed: t.bagDowned, extent: BAG_REACH, height: 1.4, shadow: t.bagShadow },
      parasol: {
        object: t.parasol,
        downed: t.parasolDowned,
        extent: PARASOL_REACH,
        height: 2.4,
        shadow: t.parasolShadow,
      },
    },
    poi: {
      arm: t.arm,
      ball: t.ball,
      strandRoot: t.strandRoot,
      strandTip: t.strandTip,
      bead: t.bead,
    },
    bag: {
      torso: t.torso,
      hands: t.hands,
      hat: t.hat,
      pack: t.pack,
      mat: t.mat,
      mug: t.mug,
    },
    parasol: { sneaker: t.sneaker, pompom: t.pompom },
    source,
  };
}
