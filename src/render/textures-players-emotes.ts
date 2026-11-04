import { TAU, WHITE, circle, type Ctx, type Piece } from './paint';
import { REFERENCE_RADIUS } from './textures-looks';

const RIM = '#000000';
const EMOTE_SUN = 10.7;
export const EMOTE_STROKE = 20;
export const EMOTE_PLATE = 25;
export const EMOTE_BURST = 10;
export const WAVE_RING = 40;
const OUTLINE_RX = 12;
const OUTLINE_RY = 24;
const OUTLINE_BAND = 14;
// Around a look that hides the body, like a parasol, the outline is a disc scaled to its cover.
export const OUTLINE_DISC = 46;

function heart(ctx: Ctx, size: number): void {
  const k = size / 9;
  ctx.beginPath();
  ctx.moveTo(0, 6 * k);
  ctx.bezierCurveTo(-2 * k, 4 * k, -9 * k, 0, -9 * k, -4 * k);
  ctx.bezierCurveTo(-9 * k, -8 * k, -4 * k, -10 * k, 0, -6 * k);
  ctx.bezierCurveTo(4 * k, -10 * k, 9 * k, -8 * k, 9 * k, -4 * k);
  ctx.bezierCurveTo(9 * k, 0, 2 * k, 4 * k, 0, 6 * k);
  ctx.closePath();
}

const HEART = 11.6;

function band(rx: number, ry: number): Piece {
  return [
    (rx + OUTLINE_BAND) * 2 + 4,
    (ry + OUTLINE_BAND) * 2 + 4,
    REFERENCE_RADIUS,
    (ctx) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, rx + OUTLINE_BAND, ry + OUTLINE_BAND, 0, 0, TAU);
      ctx.fillStyle = WHITE;
      ctx.fill();
    },
  ];
}

function liner(rx: number, ry: number): Piece {
  return [
    (rx + 5) * 2 + 4,
    (ry + 5) * 2 + 4,
    REFERENCE_RADIUS,
    (ctx) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, rx + 2.5, ry + 2.5, 0, 0, TAU);
      ctx.lineWidth = 3;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
    },
  ];
}

export const EMOTE_PIECES = {
  emoteSun: [
    32,
    32,
    REFERENCE_RADIUS,
    (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 0, EMOTE_SUN, Math.PI, TAU);
      ctx.closePath();
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = RIM;
      ctx.stroke();
    },
  ],
  emoteStroke: [
    32,
    8,
    REFERENCE_RADIUS,
    (ctx) => {
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = WHITE;
      ctx.beginPath();
      ctx.moveTo(-EMOTE_STROKE / 2 + 1.3, 0);
      ctx.lineTo(EMOTE_STROKE / 2 - 1.3, 0);
      ctx.stroke();
    },
  ],
  emotePlate: [
    64,
    64,
    REFERENCE_RADIUS,
    (ctx) => {
      circle(ctx, EMOTE_PLATE);
      ctx.fillStyle = WHITE;
      ctx.fill();
    },
  ],
  emoteHeartFill: [
    40,
    40,
    REFERENCE_RADIUS,
    (ctx) => {
      heart(ctx, HEART);
      ctx.fillStyle = WHITE;
      ctx.fill();
    },
  ],
  emoteHeartLine: [
    40,
    40,
    REFERENCE_RADIUS,
    (ctx) => {
      heart(ctx, HEART);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 5.8;
      ctx.strokeStyle = RIM;
      ctx.stroke();
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
    },
  ],
  emoteHeartInner: [
    40,
    40,
    REFERENCE_RADIUS,
    (ctx) => {
      ctx.translate(0, -1.9);
      heart(ctx, HEART * 0.66);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
    },
  ],
  emoteStar: [
    16,
    16,
    REFERENCE_RADIUS,
    (ctx) => {
      const inner = 1.4;
      ctx.beginPath();
      for (let index = 0; index < 8; index += 1) {
        const radius = index % 2 === 0 ? 5 : inner;
        const angle = (index / 8) * TAU - Math.PI / 2;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath();
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = RIM;
      ctx.stroke();
    },
  ],
  emoteBurst: [
    32,
    32,
    REFERENCE_RADIUS,
    (ctx) => {
      ctx.lineCap = 'round';
      ctx.lineWidth = 2;
      ctx.strokeStyle = WHITE;
      for (let index = 0; index < 4; index += 1) {
        const angle = (index / 4) * TAU;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * EMOTE_BURST * 0.35, Math.sin(angle) * EMOTE_BURST * 0.35);
        ctx.lineTo(Math.cos(angle) * EMOTE_BURST, Math.sin(angle) * EMOTE_BURST);
        ctx.stroke();
      }
    },
  ],
  emoteWave: [
    WAVE_RING * 2 + 8,
    WAVE_RING * 2 + 8,
    WAVE_RING,
    (ctx) => {
      circle(ctx, WAVE_RING);
      ctx.lineWidth = 4;
      ctx.strokeStyle = RIM;
      ctx.stroke();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
    },
  ],
  emoteOutline: band(OUTLINE_RX, OUTLINE_RY),
  emoteLiner: liner(OUTLINE_RX, OUTLINE_RY),
  emoteOutlineDisc: band(OUTLINE_DISC, OUTLINE_DISC),
  emoteLinerDisc: liner(OUTLINE_DISC, OUTLINE_DISC),
} satisfies Record<string, Piece>;
