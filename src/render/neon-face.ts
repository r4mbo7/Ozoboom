import { FACE_RADIUS, type Face, type Pose, shut } from './face-kit';
import { TAU, WHITE, circle, type Ctx } from './paint';

// A bar's neon sign on a board darker than the crowd's masks, drawn in units where the head is 20 wide.
const UNIT = FACE_RADIUS / 10;
export const MAGENTA = '#ff3fb0';
export const TURQUOISE = '#36f0e2';
const BOARD = '#0b0a16';
const EDGE = 'rgba(4, 6, 18, 0.9)';
const GLASS = '#596077';
const SHINE = '#a3aabf';
const CLIP = '#16141f';
const CLIP_SCREW = '#5a6074';
const HUM = { low: 0.84, swing: 0.16, shut: 0.55 };

interface Tube {
  readonly color: string;
  readonly width: number;
  readonly trace: (ctx: Ctx) => void;
}

// In the order they go out once the mask lies on the ground: the pout, the eyes, the frown, the outline.
export const NEON_TUBES: readonly Tube[] = [
  {
    color: MAGENTA,
    width: 2,
    trace: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(-4.6, 6.6);
      ctx.quadraticCurveTo(0, 2.4, 4.6, 6.6);
    },
  },
  {
    color: TURQUOISE,
    width: 1.7,
    trace: (ctx) => {
      ctx.beginPath();
      for (const side of [-1, 1]) {
        ctx.moveTo(5.2 * side, 0.2);
        ctx.lineTo(2.7 * side, 0.6);
      }
    },
  },
  {
    color: MAGENTA,
    width: 2,
    trace: (ctx) => {
      ctx.beginPath();
      ctx.moveTo(-6.4, -5.2);
      ctx.quadraticCurveTo(-3.6, -4.2, -1.7, -2.5);
      ctx.quadraticCurveTo(0, -1.1, 1.7, -2.5);
      ctx.quadraticCurveTo(3.6, -4.2, 6.4, -5.2);
    },
  },
  {
    color: TURQUOISE,
    width: 1.9,
    // One tube round the face, its two rounded ends meeting at the top.
    trace: (ctx) => {
      const [left, right, top, bottom, round] = [-7.9, 7.9, -8.6, 8.6, 6];
      ctx.beginPath();
      ctx.moveTo(-2.2, top);
      ctx.arcTo(left, top, left, bottom, round);
      ctx.arcTo(left, bottom, right, bottom, round);
      ctx.arcTo(right, bottom, right, top, round);
      ctx.arcTo(right, top, 2.2, top, round);
      ctx.lineTo(2.2, top);
    },
  },
];

function strokeTube(ctx: Ctx, tube: Tube, color: string, width: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  tube.trace(ctx);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.restore();
}

function lighter(ctx: Ctx, draw: () => void): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  draw();
  ctx.restore();
}

// A wide soft glow, the coloured glass and a white-hot core; out, grey glass.
function drawTube(ctx: Ctx, tube: Tube, light: number, out: boolean): void {
  const { color, width } = tube;
  if (out) {
    strokeTube(ctx, tube, GLASS, width, 1);
    strokeTube(ctx, tube, SHINE, width * 0.3, 0.7);
    return;
  }
  lighter(ctx, () => {
    strokeTube(ctx, tube, color, width * 5.2, 0.07 * light);
    strokeTube(ctx, tube, color, width * 2.6, 0.2 * light);
  });
  strokeTube(ctx, tube, color, width, 1);
  strokeTube(ctx, tube, WHITE, width * 0.4, 0.55 * light);
  lighter(ctx, () => {
    strokeTube(ctx, tube, WHITE, width * 0.4, 0.35 * Math.min(light, 1));
  });
}

function glow(ctx: Ctx, y: number, radius: number, color: string, alpha: number): void {
  if (alpha <= 0) {
    return;
  }
  lighter(ctx, () => {
    const light = ctx.createRadialGradient(0, y, 0, 0, y, radius);
    light.addColorStop(0, color);
    light.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.globalAlpha *= alpha;
    circle(ctx, radius, 0, y);
    ctx.fillStyle = light;
    ctx.fill();
  });
}

// `out`: how many tubes have gone out, in the order of `NEON_TUBES`.
export function neonMask(ctx: Ctx, light: number, out = 0): void {
  ctx.save();
  ctx.scale(UNIT, UNIT);
  ctx.beginPath();
  ctx.roundRect(-10, -10.8, 20, 21.6, 7.8);
  ctx.fillStyle = BOARD;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = EDGE;
  ctx.stroke();
  glow(ctx, 5, 11, MAGENTA, out > 0 ? 0 : 0.22 * light);
  glow(ctx, 0, 15, TURQUOISE, out > 3 ? 0 : 0.12 * light);
  NEON_TUBES.forEach((tube, index) => {
    drawTube(ctx, tube, light, index < out);
  });
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(7.9 * side - 1.7, 1.4, 3.4, 2.4, 0.8);
    ctx.fillStyle = CLIP;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(7.9 * side - 1.1, 2.6);
    ctx.lineTo(7.9 * side + 1.1, 2.6);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = CLIP_SCREW;
    ctx.stroke();
  }
  ctx.restore();
}

// Its light holds steady and hums on the beat: no flicker, no flash; stunned, it dims.
function neon(ctx: Ctx, pose: Pose): void {
  const hum = HUM.low + HUM.swing * (0.5 + 0.5 * Math.cos(TAU * pose.t));
  neonMask(ctx, shut(pose) ? HUM.shut : hum);
}

export const NEON_FACE: Face = { draw: neon, frames: 4, loopBeats: 1, boss: false, lit: true };
