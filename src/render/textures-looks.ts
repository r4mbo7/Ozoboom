import {
  SHADE,
  SHADE_DEEP,
  SHADE_SOFT,
  TAU,
  WHITE,
  circle,
  glow,
  paint,
  polygon,
  rim,
  type Ctx,
  type Piece,
  type Shape,
} from './paint';

// Every player texture is drawn at the scale of REFERENCE: that many pixels are one player radius.
export const REFERENCE = 32;
export const POI_ORBIT = 46;
export const POI_BALL = 9;
export const STRAND_LENGTH = 18;

function arm(ctx: Ctx): void {
  ctx.lineCap = 'round';
  // The trail lags behind the ball: the poi turn clockwise, so behind is toward negative angles.
  const steps = 10;
  for (let step = 0; step < steps; step += 1) {
    const fade = 1 - step / steps;
    ctx.strokeStyle = `rgb(255 255 255 / ${String(0.9 * fade)})`;
    ctx.lineWidth = 2 + 7 * fade;
    ctx.beginPath();
    ctx.arc(0, 0, POI_ORBIT, -1.1 * ((step + 1) / steps), -1.1 * (step / steps));
    ctx.stroke();
  }
  ctx.strokeStyle = SHADE;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(POI_ORBIT - POI_BALL, 0);
  ctx.stroke();
}

function strand(from: number, to: number): (ctx: Ctx) => void {
  return (ctx) => {
    ctx.fillStyle = WHITE;
    polygon(ctx, [
      [0, -from / 2],
      [STRAND_LENGTH, -to / 2],
      [STRAND_LENGTH, to / 2],
      [0, from / 2],
    ]);
    ctx.fill();
    circle(ctx, from / 2);
    ctx.fill();
    circle(ctx, to / 2, STRAND_LENGTH, 0);
    ctx.fill();
  };
}

// The parts la Luxiole moves on her own, drawn once in white and grays and tinted at draw time:
// one poi seen from its handle (the string along +x and the light trail behind the ball), the
// ball, and a hair ribbon in two segments along +x from the origin with its bead.
export const POI_PIECES = {
  arm: [128, 128, REFERENCE, arm],
  ball: [
    32,
    32,
    REFERENCE,
    (ctx) => {
      circle(ctx, POI_BALL);
      ctx.fillStyle = WHITE;
      ctx.fill();
      rim(ctx, 2.5);
    },
  ],
  strandRoot: [48, 12, REFERENCE, strand(6, 3.8)],
  strandTip: [48, 12, REFERENCE, strand(3.8, 1.8)],
  bead: [
    24,
    24,
    REFERENCE,
    (ctx) => {
      glow(ctx, WHITE, 5);
      ctx.fillStyle = WHITE;
      circle(ctx, 3.2);
      ctx.fill();
    },
  ],
} satisfies Record<string, Piece>;

export type PoiParts = Readonly<Record<keyof typeof POI_PIECES, Shape>>;

// Le Nounours seen from above, facing +x: the bag sits behind him, its center BAG_BACK behind his.
export const BAG_BACK = 24;
export const MAT_BACK = 40;
export const MUG_HOOK = { back: 20, side: 24 } as const;

// Le Nounours: torso and straps, the hands on the straps and the bucket hat tinted apart, the bag,
// its rolled mat, and the mug hanging along +x from its hook.
export const BAG_PIECES = {
  torso: [
    64,
    64,
    REFERENCE,
    (ctx) => {
      ctx.beginPath();
      ctx.ellipse(-1, 0, 14, 27.5, 0, 0, TAU);
      ctx.fillStyle = SHADE_SOFT;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = WHITE;
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = SHADE_DEEP;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-14, side * 14);
        ctx.quadraticCurveTo(-2, side * 17.5, 7, side * 14.7);
        ctx.stroke();
      }
    },
  ],
  hands: [
    32,
    48,
    REFERENCE,
    (ctx) => {
      for (const side of [-1, 1]) {
        circle(ctx, 4.6, 6, side * 15);
        ctx.fillStyle = WHITE;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = SHADE;
        ctx.stroke();
      }
    },
  ],
  hat: [
    40,
    40,
    REFERENCE,
    (ctx) => {
      circle(ctx, 15);
      ctx.fillStyle = WHITE;
      ctx.fill();
      rim(ctx, 1.2);
      circle(ctx, 9.4);
      ctx.fillStyle = SHADE_SOFT;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = SHADE;
      ctx.stroke();
    },
  ],
  pack: [
    48,
    64,
    REFERENCE,
    (ctx) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, 17, 25, 0, 0, TAU);
      ctx.fillStyle = SHADE_SOFT;
      ctx.fill();
      rim(ctx, 1.6);
      ctx.beginPath();
      ctx.ellipse(-2, 0, 7, 11, 0, 0, TAU);
      ctx.fillStyle = SHADE;
      ctx.fill();
      rim(ctx, 1.2);
    },
  ],
  mat: [
    16,
    52,
    REFERENCE,
    (ctx) => {
      ctx.beginPath();
      ctx.roundRect(-5, -22, 10, 44, 5);
      ctx.fillStyle = WHITE;
      ctx.fill();
      rim(ctx, 1.2);
      ctx.strokeStyle = SHADE;
      for (const y of [-11, 0, 11]) {
        ctx.beginPath();
        ctx.moveTo(-5, y);
        ctx.lineTo(5, y);
        ctx.stroke();
      }
    },
  ],
  mug: [
    48,
    16,
    REFERENCE,
    (ctx) => {
      ctx.lineWidth = 1;
      ctx.strokeStyle = SHADE;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
      circle(ctx, 4, 13, 0);
      ctx.fillStyle = WHITE;
      ctx.fill();
      rim(ctx, 1.2);
      ctx.beginPath();
      ctx.arc(13, -4.4, 2, Math.PI, TAU);
      ctx.stroke();
    },
  ],
} satisfies Record<string, Piece>;

export type BagParts = Readonly<Record<keyof typeof BAG_PIECES, Shape>>;

// L'Hygie: a sneaker along +x, its toe forward, and a pompom with its string back along -x.
export const POMPOM_STRING = 6;
export const PARASOL_PIECES = {
  sneaker: [
    24,
    16,
    REFERENCE,
    (ctx) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, 6.2, 3.8, 0, 0, TAU);
      ctx.fillStyle = SHADE_SOFT;
      ctx.fill();
      rim(ctx, 1.2);
      ctx.beginPath();
      ctx.ellipse(3.2, 0, 2.4, 2.8, 0, 0, TAU);
      ctx.fillStyle = WHITE;
      ctx.fill();
    },
  ],
  pompom: [
    32,
    16,
    REFERENCE,
    (ctx) => {
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = SHADE;
      ctx.beginPath();
      ctx.moveTo(-POMPOM_STRING, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      circle(ctx, 4.6);
      ctx.fillStyle = WHITE;
      ctx.fill();
      rim(ctx, 1.2);
    },
  ],
} satisfies Record<string, Piece>;

export type ParasolParts = Readonly<Record<keyof typeof PARASOL_PIECES, Shape>>;

export const MANDALA_RADIUS = 116;

// The flower of life the nova opens: its radius is the ring of dots, where the wave stops.
export function mandala(): Shape {
  return paint(256, 256, MANDALA_RADIUS, (ctx) => {
    const petal = 50;
    glow(ctx, WHITE, 6);
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3;
    circle(ctx, petal * 2);
    ctx.stroke();
    circle(ctx, petal);
    ctx.stroke();
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * TAU;
      circle(ctx, petal, Math.cos(angle) * petal, Math.sin(angle) * petal);
      ctx.stroke();
    }
    ctx.fillStyle = WHITE;
    for (let index = 0; index < 24; index += 1) {
      const angle = (index / 24) * TAU;
      circle(
        ctx,
        index % 6 === 0 ? 4.5 : 2.6,
        Math.cos(angle) * MANDALA_RADIUS,
        Math.sin(angle) * MANDALA_RADIUS,
      );
      ctx.fill();
    }
  });
}
