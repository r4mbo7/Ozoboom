import { TAU, WHITE, type Ctx, type Piece } from './paint';
import { REFERENCE_RADIUS } from './textures-looks';

export const DOWNED_BODY = { x: 2, rx: 11, ry: 22 };
export const DOWNED_HEAD = { x: -18, radius: 10 };
export const DOWNED_REACH = DOWNED_BODY.ry + 3;
export const BEACON = { pool: 76, column: { width: 96, height: 320 }, wave: 60 };

function silhouette(ctx: Ctx): void {
  ctx.beginPath();
  ctx.ellipse(DOWNED_BODY.x, 0, DOWNED_BODY.rx, DOWNED_BODY.ry, 0, 0, TAU);
  ctx.moveTo(DOWNED_HEAD.x + DOWNED_HEAD.radius, 0);
  ctx.arc(DOWNED_HEAD.x, 0, DOWNED_HEAD.radius, 0, TAU);
}

function radial(ctx: Ctx, radius: number, stops: readonly (readonly [number, number])[]): void {
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  for (const [at, alpha] of stops) {
    gradient.addColorStop(at, `rgb(255 255 255 / ${String(alpha)})`);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(-radius, -radius, 2 * radius, 2 * radius);
}

// Nested columns, wider toward the camera, brightest a little above the ground.
function column(ctx: Ctx): void {
  const { width, height } = BEACON.column;
  const top = -height / 2;
  const bottom = height / 2;
  for (const [base, spread, alpha] of [
    [0.62, 0.84, 0.35],
    [0.44, 0.62, 0.45],
    [0.26, 0.38, 0.6],
  ] as const) {
    const gradient = ctx.createLinearGradient(0, bottom, 0, top);
    gradient.addColorStop(0, `rgb(255 255 255 / ${String(alpha * 0.4)})`);
    gradient.addColorStop(0.2, `rgb(255 255 255 / ${String(alpha)})`);
    gradient.addColorStop(0.6, `rgb(255 255 255 / ${String(alpha * 0.45)})`);
    gradient.addColorStop(1, 'rgb(255 255 255 / 0)');
    ctx.beginPath();
    ctx.moveTo((-width / 2) * base, bottom);
    ctx.lineTo((-width / 2) * spread, top);
    ctx.lineTo((width / 2) * spread, top);
    ctx.lineTo((width / 2) * base, bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }
}

export const DOWNED_PIECES = {
  downedFill: [
    128,
    128,
    REFERENCE_RADIUS,
    (ctx) => {
      silhouette(ctx);
      ctx.fillStyle = WHITE;
      ctx.fill();
    },
  ],
  downedVeil: [
    128,
    128,
    48,
    (ctx) => {
      radial(ctx, 48, [
        [0, 0],
        [0.35, 0],
        [1, 1],
      ]);
    },
  ],
  firefly: [
    16,
    16,
    REFERENCE_RADIUS,
    (ctx) => {
      ctx.beginPath();
      ctx.arc(0, 0, 3.4, 0, TAU);
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000000';
      ctx.stroke();
    },
  ],
  swarmDot: [
    24,
    24,
    REFERENCE_RADIUS,
    (ctx) => {
      radial(ctx, 10, [
        [0, 1],
        [0.32, 1],
        [0.45, 0.4],
        [1, 0],
      ]);
    },
  ],
  beaconPool: [
    2 * BEACON.pool + 4,
    2 * BEACON.pool + 4,
    BEACON.pool,
    (ctx) => {
      radial(ctx, BEACON.pool, [
        [0, 0.12],
        [0.6, 0.22],
        [0.88, 0.55],
        [0.94, 0.3],
        [1, 0],
      ]);
    },
  ],
  beaconColumn: [BEACON.column.width, BEACON.column.height, BEACON.column.height / 2, column],
  beaconWave: [
    2 * BEACON.wave + 4,
    2 * BEACON.wave + 4,
    BEACON.wave,
    (ctx) => {
      radial(ctx, BEACON.wave, [
        [0, 0],
        [0.7, 0],
        [0.93, 0.35],
        [0.97, 1],
        [1, 0],
      ]);
    },
  ],
} satisfies Record<string, Piece>;
