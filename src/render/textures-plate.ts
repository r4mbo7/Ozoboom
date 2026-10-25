import { TAU, WHITE, circle, paint, type Ctx, type Shape } from './paint';
import { GOLD, OUT, stroke } from './totem-face';

// The assiettes chinoises as Constantin chose them (review of 2026-10-25): a plate glazed with
// night, where two fluo koi chase each other around a gold pearl, and its zone the plate's rim
// painted large on the ground, a frieze of curling waves. The plate keeps its own colours at every
// moment, like the Totem; the rim is white, tinted with the class.
export interface PlateTextures {
  readonly dish: Shape;
  // A still glint over the dish, so that it reads as spinning under it.
  readonly glint: Shape;
  readonly rim: Shape;
  // The gilt dots between the waves of the rim, tinted gold.
  readonly gilt: Shape;
}

const DISH = 32;
const RIM = 120;
const DENSITY = 2;
const GLAZE_LIGHT = '#2c3c96';
const GLAZE_DEEP = '#141b4e';
const KOI = ['#7cf2b0', '#ff6fa8'] as const;
const KOI_ORBIT = 16;
const WAVES = 14;
const BAND = 11;
const CREST = 6.8;

// A koi seen from above, its body bent along the circle of radius r, its nose at angle a.
function koi(ctx: Ctx, a: number, r: number, color: string, outlined: boolean): void {
  const span = 1.6;
  const width = 6.2;
  const steps = 14;
  const at = (angle: number, radius: number) =>
    [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
  const outer: (readonly [number, number])[] = [];
  const inner: (readonly [number, number])[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const u = i / steps;
    const angle = a - span * (1 - u);
    const half = width * (0.32 + 0.68 * Math.sin(Math.PI * (0.08 + 0.8 * u)));
    outer.push(at(angle, r + half));
    inner.push(at(angle, r - half));
  }
  const tail = a - span;
  const points = [
    ...outer,
    at(a + 0.16, r + width * 0.3),
    at(a + 0.2, r),
    at(a + 0.16, r - width * 0.3),
    ...inner.reverse(),
    at(tail - 0.38, r - width * 1.25),
    at(tail - 0.2, r),
    at(tail - 0.38, r + width * 1.25),
  ];
  ctx.beginPath();
  for (const [x, y] of points) {
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (!outlined) {
    return;
  }
  stroke(ctx, OUT, 1.8);
  const [eyeX, eyeY] = at(a - 0.12, r + width * 0.38);
  ctx.fillStyle = OUT;
  circle(ctx, 1.5, eyeX, eyeY);
  ctx.fill();
}

function dish(ctx: Ctx): void {
  ctx.fillStyle = OUT;
  circle(ctx, DISH + 3.5);
  ctx.fill();
  const glaze = ctx.createRadialGradient(-8, -10, 2, 0, 0, DISH);
  glaze.addColorStop(0, GLAZE_LIGHT);
  glaze.addColorStop(1, GLAZE_DEEP);
  ctx.fillStyle = glaze;
  circle(ctx, DISH);
  ctx.fill();
  circle(ctx, DISH - 2);
  stroke(ctx, WHITE, 4);
  ctx.globalAlpha = 0.5;
  circle(ctx, DISH - 8.4);
  stroke(ctx, WHITE, 1.2);
  // Each koi leaves a soft wake behind it, painted on the glaze.
  for (const [behind, alpha] of [
    [0.34, 0.12],
    [0.17, 0.26],
  ] as const) {
    ctx.globalAlpha = alpha;
    KOI.forEach((color, index) => {
      koi(ctx, index * Math.PI - behind, KOI_ORBIT, color, false);
    });
  }
  ctx.globalAlpha = 1;
  KOI.forEach((color, index) => {
    koi(ctx, index * Math.PI, KOI_ORBIT, color, true);
  });
  ctx.fillStyle = GOLD;
  circle(ctx, 4.2);
  ctx.fill();
  stroke(ctx, OUT, 1.6);
}

function glint(ctx: Ctx): void {
  ctx.fillStyle = 'rgb(255 255 255 / 0.2)';
  ctx.beginPath();
  ctx.ellipse(-10, -13, 11, 4.8, -0.7, 0, TAU);
  ctx.fill();
}

// A point of the band, u along the ring, v outward from its middle line.
function onBand(u: number, v: number): readonly [number, number] {
  const angle = u / RIM;
  return [Math.cos(angle) * (RIM + v), Math.sin(angle) * (RIM + v)];
}

// One breaking wave of the porcelain rim: it rises from the inner edge and curls in.
function wave(ctx: Ctx, from: number, length: number): void {
  const crest = from + length * 0.62;
  ctx.beginPath();
  for (let i = 0; i <= 10; i += 1) {
    const k = i / 10;
    const [x, y] = onBand(from + (crest - from) * k, -CREST + 2 * CREST * k * k * (3 - 2 * k));
    ctx.lineTo(x, y);
  }
  for (let i = 1; i <= 26; i += 1) {
    const k = i / 26;
    const turn = Math.PI / 2 - k * 2.4 * Math.PI;
    const radius = CREST * (1 - 0.8 * k);
    const [x, y] = onBand(crest + radius * Math.cos(turn), radius * Math.sin(turn));
    ctx.lineTo(x, y);
  }
  stroke(ctx, WHITE, 2.8);
}

function rim(ctx: Ctx): void {
  // A very faint tint inside, so that the zone reads without a filled disc.
  ctx.fillStyle = 'rgb(255 255 255 / 0.07)';
  circle(ctx, RIM - BAND);
  ctx.fill();
  ctx.fillStyle = 'rgb(255 255 255 / 0.13)';
  ctx.beginPath();
  ctx.arc(0, 0, RIM + BAND, 0, TAU);
  ctx.arc(0, 0, RIM - BAND, 0, TAU, true);
  ctx.fill();
  ctx.globalAlpha = 0.6;
  circle(ctx, RIM + BAND);
  stroke(ctx, WHITE, 2.4);
  ctx.globalAlpha = 0.45;
  circle(ctx, RIM - BAND);
  stroke(ctx, WHITE, 1.6);
  ctx.globalAlpha = 0.7;
  const length = (TAU * RIM) / WAVES;
  for (let i = 0; i < WAVES; i += 1) {
    wave(ctx, i * length, length);
  }
}

function gilt(ctx: Ctx): void {
  const length = (TAU * RIM) / WAVES;
  ctx.fillStyle = WHITE;
  for (let i = 0; i < WAVES; i += 1) {
    const [x, y] = onBand(i * length + length * 0.2, BAND - 3.2);
    circle(ctx, 1.8, x, y);
    ctx.fill();
  }
}

export function createPlateTextures(): PlateTextures {
  const side = (DISH + 8) * 2;
  const band = (RIM + BAND + 4) * 2;
  return {
    dish: paint(side, side, DISH, dish, DENSITY),
    glint: paint(side, side, DISH, glint, DENSITY),
    rim: paint(band, band, RIM, rim),
    gilt: paint(band, band, RIM, gilt),
  };
}
