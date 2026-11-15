import { clamp01, frac, smoothstep } from '../shared/scalar';
import { BAR_BEATS, EDGE, GROUNDED, type Dance, ellipse, faded, fill, inked } from './dance-kit';
import { TAU, circle, type Ctx } from './paint';

// As drawn on the choice page: a barefoot dancer under the rain, bare chest, olive scarf, earth
// sarouel, head thrown back with his eyes closed, one arm flung wide.
const SKIN = '#ecb98f';
const SKIN_DARK = '#c98d63';
const PANTS = '#9c6a3c';
const PANTS_DARK = '#5e3c1f';
const PANTS_LIGHT = '#c08a55';
const SCARF = '#8f8c3e';
const SCARF_DARK = '#5c5a24';
const HAIR = '#4a2c16';
const LEATHER = '#3e2412';
const BEAD = '#3fd0c9';
const MUD = '#d8c3a0';
const MOUTH = '#4a1a14';
const SCALE = 0.82;
const SPLASH_BEATS = 0.6;

// One sway over a bar: a slow, loose trance, never a jump.
function swayOf(beat: number): number {
  return Math.sin((beat / BAR_BEATS) * TAU);
}

function stroke(ctx: Ctx, color: string, width: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function arc(ctx: Ctx, x: number, y: number, radius: number, from: number, to: number) {
  ctx.beginPath();
  ctx.arc(x, y, radius, from * Math.PI, to * Math.PI);
}

function dot(ctx: Ctx, x: number, y: number, radius: number, color: string, edge: number) {
  circle(ctx, radius, x, y);
  fill(ctx, color, edge);
}

// Turned by `turn` around (x, y).
function around(ctx: Ctx, x: number, y: number, turn: number, draw: () => void): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  draw();
  ctx.restore();
}

// A leather cuff and its turquoise beads at the wrist, across the forearm.
function bracelet(ctx: Ctx, x: number, y: number, turn: number): void {
  around(ctx, x, y, turn, () => {
    ctx.beginPath();
    ctx.roundRect(-1.1, -2.6, 2.2, 5.2, 1);
    fill(ctx, LEATHER, 0.7);
    for (const along of [-1.5, 0, 1.5]) {
      dot(ctx, 2.3, along, 0.75, BEAD, 0.4);
    }
  });
}

// An arm from the shoulder: the upper arm at `angle`, the forearm bent by `bend`.
function arm(ctx: Ctx, x: number, y: number, angle: number, bend: number, length: number) {
  const elbow = [x + Math.cos(angle) * length, y + Math.sin(angle) * length] as const;
  const hand = [
    elbow[0] + Math.cos(angle + bend) * length,
    elbow[1] + Math.sin(angle + bend) * length,
  ] as const;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(...elbow);
  ctx.lineTo(...hand);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  inked(ctx, SKIN, 3.6, 2.6);
  bracelet(
    ctx,
    hand[0] - Math.cos(angle + bend) * 2.6,
    hand[1] - Math.sin(angle + bend) * 2.6,
    angle + bend,
  );
  dot(ctx, hand[0], hand[1], 2.3, SKIN, 1);
}

// Bare feet under the gathered cuffs, one lifting off between beats, slapping down on the beat.
function feet(ctx: Ctx, beat: number, sway: number): void {
  const step = Math.floor(beat) % 2;
  const lift = Math.sin(frac(beat) * Math.PI);
  for (const side of [-1, 1]) {
    const up = side < 0 === (step === 0) ? lift * 2.2 : 0;
    ellipse(ctx, side * 6.2 + sway * 0.6, 19.6 - up, 2.6, 3.4, side * 0.15);
    fill(ctx, SKIN, 1);
  }
}

// Wide, dropped low between the legs, billowing with the hips.
function sarouel(ctx: Ctx, sway: number, lag: number): void {
  around(ctx, sway * 1.2, 0, sway * 0.05, () => {
    const billow = 1 + 0.06 * lag;
    ctx.beginPath();
    ctx.moveTo(-6.2, 3.4);
    ctx.bezierCurveTo(-12 * billow, 5, -12.8 * billow, 13.5, -8.2, 17.6);
    ctx.lineTo(-4.2, 17.8);
    ctx.quadraticCurveTo(0, 15.8, 4.2, 17.8);
    ctx.lineTo(8.2, 17.6);
    ctx.bezierCurveTo(12.8 * billow, 13.5, 12 * billow, 5, 6.2, 3.4);
    ctx.closePath();
    fill(ctx, PANTS, 1.6);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 3.4, 7);
      ctx.quadraticCurveTo(side * 7.6, 10.5, side * 6.4, 15.6);
      stroke(ctx, PANTS_DARK, 0.9);
      ctx.beginPath();
      ctx.moveTo(side * 7.9, 17.6);
      ctx.lineTo(side * 4.4, 17.8);
      stroke(ctx, PANTS_DARK, 1.6);
    }
    faded(ctx, 0.6, () => {
      arc(ctx, -7.5, 10, 4, 0.95, 1.35);
      stroke(ctx, PANTS_LIGHT, 1);
    });
    ctx.beginPath();
    ctx.roundRect(-7, 2.4, 14, 2.6, 1.2);
    fill(ctx, LEATHER, 0.8);
  });
}

function chest(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-8.6, -6.2);
  ctx.quadraticCurveTo(0, -8.4, 8.6, -6.2);
  ctx.quadraticCurveTo(10.4, -4.8, 8.6, -2.6);
  ctx.quadraticCurveTo(6.4, 0.6, 5.8, 3.6);
  ctx.lineTo(-5.8, 3.6);
  ctx.quadraticCurveTo(-6.4, 0.6, -8.6, -2.6);
  ctx.quadraticCurveTo(-10.4, -4.8, -8.6, -6.2);
  ctx.closePath();
  fill(ctx, SKIN, 1.8);
  faded(ctx, 0.5, () => {
    arc(ctx, -2.8, -3.2, 2.8, 0.2, 0.75);
    stroke(ctx, SKIN_DARK, 0.9);
    arc(ctx, 2.8, -3.2, 2.8, 0.25, 0.8);
    stroke(ctx, SKIN_DARK, 0.9);
    ctx.beginPath();
    ctx.moveTo(0, -0.6);
    ctx.lineTo(0, 2.4);
    stroke(ctx, SKIN_DARK, 0.7);
  });
}

// Knotted loose: a drape around the neck, a knot, two tails swinging behind the sway.
function scarf(ctx: Ctx, lag: number): void {
  ctx.beginPath();
  ctx.moveTo(-5.6, -6.4);
  ctx.quadraticCurveTo(-2.2, -0.4, 1.2, -1.4);
  ctx.quadraticCurveTo(3.6, -2.2, 5.6, -6.4);
  ctx.lineCap = 'round';
  inked(ctx, SCARF, 2.3, 1.5);
  const tail = -lag * 1.6;
  for (const [shift, length] of [
    [-0.6, 5.6],
    [1.8, 4.2],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(1 + shift * 0.4, -1.2);
    ctx.quadraticCurveTo(
      1 + shift + tail * 0.5,
      -1.2 + length * 0.6,
      1 + shift + tail,
      -1.2 + length,
    );
    ctx.lineCap = 'round';
    inked(ctx, SCARF, 1.6, 1.4);
  }
  ellipse(ctx, 1.2, -1.4, 1.6, 1.3, 0.3);
  fill(ctx, SCARF_DARK, 0.8);
  for (let bead = 0; bead < 7; bead += 1) {
    const angle = Math.PI * (0.18 + (0.64 * bead) / 6);
    dot(ctx, Math.cos(angle) * 3.8, -5.6 + Math.sin(angle) * 2.4, 0.9, BEAD, 0.4);
  }
}

// Thrown back to the sky: the hair knot over the crown, a beard, eyes closed, mouth open to the rain.
function head(ctx: Ctx, lag: number): void {
  around(ctx, 0, -9.6, 0.16 * lag, () => {
    dot(ctx, 0, -6.8, 2.4, HAIR, 1);
    dot(ctx, 0, -0.6, 6, SKIN, 1.5);
    ctx.beginPath();
    ctx.moveTo(-5.8, 1);
    ctx.quadraticCurveTo(-4.8, 5.8, 0, 7);
    ctx.quadraticCurveTo(4.8, 5.8, 5.8, 1);
    ctx.quadraticCurveTo(3.4, 4.6, 0, 4.4);
    ctx.quadraticCurveTo(-3.4, 4.6, -5.8, 1);
    ctx.closePath();
    fill(ctx, HAIR, 0.8);
    ctx.beginPath();
    ctx.ellipse(0, -3, 6, 3.8, 0, Math.PI, TAU);
    fill(ctx, HAIR);
    for (const x of [-2.4, 2.4]) {
      arc(ctx, x, -0.4, 1.4, 0.1, 0.9);
      stroke(ctx, EDGE, 1.1);
    }
    ellipse(ctx, 0, 3.4, 1.1, 1.4);
    fill(ctx, MOUTH, 0.6);
    arc(ctx, 0, 3.6, 2.4, 1.15, 1.85);
    stroke(ctx, HAIR, 0.9);
  });
}

// Muddy water splashing from the foot that lands on the beat.
function splash(ctx: Ctx, beat: number): void {
  const since = frac(beat);
  if (since > SPLASH_BEATS) {
    return;
  }
  const side = Math.floor(beat) % 2 === 0 ? 1 : -1;
  const x = side * 6.2 + swayOf(Math.floor(beat)) * 0.6;
  const share = since / SPLASH_BEATS;
  faded(ctx, 1 - share, () => {
    const reach = 3.5 + 6 * smoothstep(clamp01(share));
    for (let drop = 0; drop < 5; drop += 1) {
      const angle = Math.PI * (0.9 + (0.8 * drop) / 4) + (side > 0 ? 0.25 : -0.25);
      circle(
        ctx,
        1.2 - 0.35 * (drop % 2),
        x + Math.cos(angle) * reach * 1.2,
        21 + Math.sin(angle) * reach * 0.5,
      );
      fill(ctx, MUD);
    }
    faded(ctx, 0.6, () => {
      ellipse(ctx, x, 21.5, 3 + 6 * since, 1.2 + 2 * since);
      stroke(ctx, MUD, 0.8);
    });
  });
}

function drawRain(ctx: Ctx, beat: number): void {
  const sway = swayOf(beat);
  const lag = swayOf(beat - 0.5);
  ctx.translate(0, -2);
  ctx.scale(SCALE, SCALE);
  splash(ctx, beat);
  feet(ctx, beat, sway);
  sarouel(ctx, sway, lag);
  // The upper body sways ahead of the hips.
  around(ctx, sway * 1.8, 0, sway * 0.1, () => {
    arm(ctx, -7.6, -3.6, Math.PI + 0.15 - 0.35 * sway, -0.25 + 0.2 * lag, 8.2);
    arm(ctx, 7.6, -3.6, 0.55 - 0.35 * sway, 1.25 - 0.25 * lag, 7.4);
    chest(ctx);
    scarf(ctx, lag);
    head(ctx, lag);
  });
}

// Still in calm mode: his feet down, no splash.
export const RAIN: Dance = { frames: 24, still: 0.85, draw: drawRain, jumpAt: () => GROUNDED };
