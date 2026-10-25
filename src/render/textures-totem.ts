import { TAU, WHITE, circle, paint, type Ctx, type Shape } from './paint';
import {
  GOLD,
  HEAD,
  OR,
  OUT,
  TANK,
  TANK_DEEP,
  TANK_LIGHT,
  WOOD,
  face,
  openEye,
  stroke,
} from './totem-face';

// The Totem as Constantin chose it (review of 2026-10-25): a carved pole crowned by a serene sun
// face whose third eye opens on each wave, standing on a sub speaker that breathes in and thumps.
// It keeps its own colours at every moment, like a mask: warm gold, so it never reads as a bad vibe.
export interface TotemTextures {
  readonly body: Shape;
  readonly eye: Shape;
  readonly cone: Shape;
  readonly bass: Shape;
  readonly pull: Shape;
  // The body cut lower and lower, as it dissolves from the top down.
  readonly dissolve: readonly Shape[];
}

// Texture units, from the foot of the pole.
export const TOTEM_HEIGHT = 108;
export const TOTEM_FOOT = 58;
export const TOTEM_EYE_Y = -79.5;
const TOTEM_HEAD_Y = -66;
const FLAMES = 12;
const DENSITY = 2;
const DISSOLVE_STEPS = 6;
// The top of the silhouette, white rim included, from the foot.
const TOP = -108;

function crown(ctx: Ctx): void {
  ctx.beginPath();
  for (let i = 0; i < FLAMES; i += 1) {
    const a = -Math.PI / 2 + (i * TAU) / FLAMES;
    const length = i % 2 === 0 ? 14 : 9;
    const half = Math.PI / FLAMES;
    const at = (angle: number, radius: number) =>
      [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
    const [x0, y0] = at(a - half, HEAD - 1);
    const [cx0, cy0] = at(a - 0.18, HEAD + length * 0.75);
    const [tx, ty] = at(a + 0.14, HEAD + length);
    const [cx1, cy1] = at(a + 0.05, HEAD + length * 0.35);
    const [x1, y1] = at(a + half, HEAD - 1);
    if (i === 0) {
      ctx.moveTo(x0, y0);
    } else {
      ctx.lineTo(x0, y0);
    }
    ctx.quadraticCurveTo(cx0, cy0, tx, ty);
    ctx.quadraticCurveTo(cx1, cy1, x1, y1);
  }
  ctx.closePath();
}

function pole(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(-8, -2);
  ctx.lineTo(-6, -48);
  ctx.lineTo(6, -48);
  ctx.lineTo(8, -2);
  ctx.quadraticCurveTo(0, 3, -8, -2);
  ctx.closePath();
}

function body(ctx: Ctx): void {
  ctx.translate(0, TOTEM_FOOT);
  // A white rim around the whole silhouette, then each piece with its thick dark outline.
  pole(ctx);
  stroke(ctx, WHITE, 8);
  ctx.save();
  ctx.translate(0, TOTEM_HEAD_Y);
  crown(ctx);
  stroke(ctx, WHITE, 8);
  ctx.restore();
  pole(ctx);
  stroke(ctx, OUT, 4.5);
  const wood = ctx.createLinearGradient(-8, 0, 8, 0);
  wood.addColorStop(0, TANK_LIGHT);
  wood.addColorStop(0.45, TANK);
  wood.addColorStop(1, TANK_DEEP);
  ctx.fillStyle = wood;
  ctx.fill();
  for (const y of [-13, -29]) {
    const half = 7.6 + y * 0.035;
    ctx.beginPath();
    ctx.roundRect(-half, y - 3, half * 2, 6, 1.5);
    ctx.fillStyle = OR;
    ctx.fill();
    stroke(ctx, WOOD, 1.3);
    ctx.beginPath();
    for (let k = 0; k <= 4; k += 1) {
      ctx.lineTo(-half + (k * half) / 2, y + (k % 2 === 0 ? 1.6 : -1.6));
    }
    stroke(ctx, WOOD, 1);
  }
  ctx.translate(0, TOTEM_HEAD_Y);
  crown(ctx);
  stroke(ctx, OUT, 4.5);
  ctx.fillStyle = TANK;
  ctx.fill();
  ctx.fillStyle = GOLD;
  for (let i = 0; i < FLAMES; i += 1) {
    const a = -Math.PI / 2 + (i * TAU) / FLAMES;
    const length = i % 2 === 0 ? 9 : 5;
    ctx.save();
    ctx.translate(Math.cos(a) * (HEAD + 1), Math.sin(a) * (HEAD + 1));
    ctx.rotate(a + 0.08);
    ctx.beginPath();
    ctx.ellipse(length * 0.45, 0, length * 0.55, i % 2 === 0 ? 2.2 : 1.6, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  face(ctx);
}

// The sub on the ground, seen from above: frame, surround, cone and dust cap.
function cone(ctx: Ctx): void {
  const ellipse = (rx: number, ry: number, y = 0) => {
    ctx.beginPath();
    ctx.ellipse(0, y, rx, ry, 0, 0, TAU);
  };
  ellipse(18, 10.5);
  stroke(ctx, WHITE, 5.5);
  ctx.fillStyle = TANK;
  ctx.fill();
  stroke(ctx, OUT, 3);
  ellipse(14.5, 8.2);
  ctx.fillStyle = '#2a1a18';
  ctx.fill();
  stroke(ctx, OUT, 1.2);
  const deep = ctx.createRadialGradient(0, -1, 1, 0, 0, 11);
  deep.addColorStop(0, '#5a3424');
  deep.addColorStop(1, '#1c1012');
  ctx.fillStyle = deep;
  ellipse(11, 6.2);
  ctx.fill();
  ctx.globalAlpha = 0.45;
  ellipse(7.5, 4.2);
  stroke(ctx, TANK, 0.9);
  ctx.globalAlpha = 1;
  ellipse(4.4, 2.7, -1);
  ctx.fillStyle = TANK;
  ctx.fill();
  stroke(ctx, OUT, 1.2);
}

// A gold seam on the cut, and a soft edge above it.
function dissolved(step: number): (ctx: Ctx) => void {
  return (ctx) => {
    ctx.save();
    body(ctx);
    ctx.restore();
    ctx.translate(0, TOTEM_FOOT);
    const cut = TOP + ((step + 1) / (DISSOLVE_STEPS + 1)) * (4 - TOP);
    ctx.globalCompositeOperation = 'destination-out';
    const edge = ctx.createLinearGradient(0, cut - 8, 0, cut);
    edge.addColorStop(0, 'rgb(0 0 0 / 1)');
    edge.addColorStop(1, 'rgb(0 0 0 / 0)');
    ctx.fillStyle = edge;
    ctx.fillRect(-60, cut - 8, 120, 8);
    ctx.fillStyle = OUT;
    ctx.fillRect(-60, TOP - 8, 120, cut - TOP);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = GOLD;
    ctx.fillRect(-60, cut - 1.5, 120, 3);
  };
}

export function createTotemTextures(): TotemTextures {
  return {
    body: paint(112, 132, 66, body, DENSITY),
    eye: paint(24, 24, 5, openEye, DENSITY),
    cone: paint(44, 30, 20, cone, DENSITY),
    dissolve: Array.from({ length: DISSOLVE_STEPS }, (_, step) =>
      paint(112, 132, 66, dissolved(step)),
    ),
    // The bass ring: thick, tinted with the class at each moment of the sun.
    bass: paint(160, 160, 64, (ctx) => {
      ctx.strokeStyle = WHITE;
      circle(ctx, 64);
      ctx.lineWidth = 10;
      ctx.stroke();
    }),
    // The air sucked in: short streaks that close in on the speaker.
    pull: paint(160, 160, 64, (ctx) => {
      ctx.strokeStyle = WHITE;
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.4;
      const streaks = 18;
      for (let i = 0; i < streaks; i += 1) {
        const a = (i * TAU) / streaks;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 64, Math.sin(a) * 64);
        ctx.lineTo(Math.cos(a + 0.12) * 50, Math.sin(a + 0.12) * 50);
        ctx.stroke();
      }
    }),
  };
}
