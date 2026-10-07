import {
  SHADE,
  TAU,
  WHITE,
  circle,
  glow,
  paint,
  polygon,
  rim,
  type Ctx,
  type Shape,
} from './paint';

// Every player texture is drawn at the scale of REFERENCE: that many pixels are one player radius.
export const REFERENCE = 32;
export const POI_ORBIT = 46;
export const POI_BALL = 9;
export const STRAND_LENGTH = 18;

// The parts a look moves on its own, each drawn once in white and grays, tinted at draw time.
export interface PoiParts {
  // One poi seen from its handle: the string along +x and the light trail behind the ball.
  readonly arm: Shape;
  readonly ball: Shape;
  // A hair ribbon in two segments along +x from the origin, the second thinner, and its bead.
  readonly strandRoot: Shape;
  readonly strandTip: Shape;
  readonly bead: Shape;
}

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

export function createPoiParts(): PoiParts {
  return {
    arm: paint(128, 128, REFERENCE, arm),
    ball: paint(32, 32, REFERENCE, (ctx) => {
      circle(ctx, POI_BALL);
      ctx.fillStyle = WHITE;
      ctx.fill();
      rim(ctx, 2.5);
    }),
    strandRoot: paint(48, 12, REFERENCE, strand(6, 3.8)),
    strandTip: paint(48, 12, REFERENCE, strand(3.8, 1.8)),
    bead: paint(24, 24, REFERENCE, (ctx) => {
      glow(ctx, WHITE, 5);
      ctx.fillStyle = WHITE;
      circle(ctx, 3.2);
      ctx.fill();
    }),
  };
}

export function poiPartShapes(parts: PoiParts): Shape[] {
  return [parts.arm, parts.ball, parts.strandRoot, parts.strandTip, parts.bead];
}

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
