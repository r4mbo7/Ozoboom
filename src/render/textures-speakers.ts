import {
  SHADE_DEEP,
  TAU,
  WHITE,
  circle,
  doubleStroke,
  glow,
  paint,
  type Ctx,
  type Draw,
  type Shape,
} from './paint';

export interface SpeakerShapes {
  readonly speakers: Readonly<Record<string, Shape>>;
  readonly zone: Shape;
  readonly sweep: Shape;
}

const SWEEP_LENGTH = 128;
const SWEEP_HALF_ANGLE = 0.13;
// Drawn for a speaker of radius 40, seen from above, its front toward +y; painted twice as fine.
const DRAWN_RADIUS = 40;
const FINE = 2;
const SIZE = 144;

function part(ctx: Ctx, build: (ctx: Ctx) => void): void {
  ctx.beginPath();
  build(ctx);
  ctx.fillStyle = SHADE_DEEP;
  ctx.fill();
  ctx.strokeStyle = WHITE;
  doubleStroke(ctx, 6, 2.2);
}

function thin(ctx: Ctx, build: (ctx: Ctx) => void, alpha = 0.85, width = 1.4): void {
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  build(ctx);
  ctx.lineWidth = width;
  ctx.strokeStyle = `rgb(255 255 255 / ${String(alpha)})`;
  ctx.stroke();
  ctx.restore();
}

function dot(ctx: Ctx, x: number, y: number, radius: number): void {
  circle(ctx, radius, x, y);
  ctx.fillStyle = WHITE;
  ctx.fill();
}

function grille(ctx: Ctx, x0: number, x1: number, y: number, height: number): void {
  thin(
    ctx,
    (p) => {
      p.roundRect(x0, y, x1 - x0, height, 2);
      for (let x = x0 + 4; x < x1 - 1; x += 4) {
        p.moveTo(x, y + 1.5);
        p.lineTo(x, y + height - 1.5);
      }
    },
    0.9,
    1.2,
  );
}

function slot(ctx: Ctx, x: number, y: number, width: number): void {
  thin(
    ctx,
    (p) => {
      p.roundRect(x - width / 2, y - 2.5, width, 5, 2.5);
    },
    0.75,
  );
}

function ring(count: number, radius: number, turn: number): (readonly [number, number])[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = turn + (index * TAU) / count;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
  });
}

function trace(ctx: Ctx, points: readonly (readonly [number, number])[]): void {
  for (const [index, [x, y]] of points.entries()) {
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

const tarp: Draw = (ctx) => {
  for (const x0 of [-36, 10]) {
    part(ctx, (p) => {
      p.roundRect(x0, 14, 26, 16, 3);
    });
    grille(ctx, x0 + 3, x0 + 23, 23, 5);
  }
  thin(
    ctx,
    (p) => {
      for (const [x, y, dx, dy] of [
        [-44, -34, -1, -1],
        [44, -34, 1, -1],
        [-44, 22, -1, 1],
        [44, 22, 1, 1],
      ] as const) {
        p.moveTo(x, y);
        p.lineTo(x + dx * 11, y + dy * 11);
      }
    },
    0.8,
    1.3,
  );
  for (const [x, y] of [
    [-55, -45],
    [55, -45],
    [-55, 33],
    [55, 33],
  ] as const) {
    dot(ctx, x, y, 2.4);
  }
  part(ctx, (p) => {
    p.rect(-44, -34, 88, 56);
  });
  thin(ctx, (p) => {
    p.moveTo(-44, -34);
    p.lineTo(-18, -6);
    p.lineTo(18, -6);
    p.lineTo(44, -34);
    p.moveTo(-44, 22);
    p.lineTo(-18, -6);
    p.moveTo(44, 22);
    p.lineTo(18, -6);
  });
};

const tower: Draw = (ctx) => {
  for (let side = 0; side < 4; side += 1) {
    ctx.save();
    ctx.rotate((side * Math.PI) / 2);
    part(ctx, (p) => {
      p.roundRect(-14, 36, 28, 12, 2);
    });
    grille(ctx, -11, 11, 39, 6);
    ctx.restore();
  }
  const roof = ring(8, 42, Math.PI / 8);
  const top = ring(8, 13, Math.PI / 8);
  part(ctx, (p) => {
    trace(p, roof);
  });
  thin(ctx, (p) => {
    trace(p, top);
    for (const [index, [x, y]] of roof.entries()) {
      const [tx, ty] = top[index] ?? [0, 0];
      p.moveTo(x, y);
      p.lineTo(tx, ty);
    }
  });
  thin(
    ctx,
    (p) => {
      for (let index = 0; index < 8; index += 1) {
        const angle = Math.PI / 8 + ((index + 0.5) * TAU) / 8;
        p.moveTo(Math.cos(angle) * 16, Math.sin(angle) * 16);
        p.lineTo(Math.cos(angle) * 36, Math.sin(angle) * 36);
      }
    },
    0.4,
    1,
  );
  dot(ctx, 0, 0, 3);
};

const wall: Draw = (ctx) => {
  part(ctx, (p) => {
    p.roundRect(-18, -46, 36, 15, 3);
  });
  for (const x of [-9, 0, 9]) {
    dot(ctx, x, -38.5, 1.8);
  }
  for (let index = 0; index < 4; index += 1) {
    const angle = (index - 1.5) * 0.26;
    ctx.save();
    ctx.translate(Math.sin(angle) * 110, Math.cos(angle) * 110 - 114);
    ctx.rotate(-angle);
    part(ctx, (p) => {
      p.roundRect(-11, -18, 22, 34, 3);
    });
    slot(ctx, 0, -8, 10);
    grille(ctx, -8, 8, 8, 6);
    ctx.restore();
  }
};

const pylon: Draw = (ctx) => {
  const feet = [Math.PI / 2, (Math.PI * 7) / 6, -Math.PI / 6].map(
    (angle) => [Math.cos(angle) * 50, Math.sin(angle) * 50] as const,
  );
  thin(
    ctx,
    (p) => {
      for (const [x, y] of feet) {
        p.moveTo(0, 0);
        p.lineTo(x, y);
      }
    },
    0.9,
    1.8,
  );
  for (const [x, y] of feet) {
    dot(ctx, x, y, 2.4);
  }
  part(ctx, (p) => {
    p.arc(0, 0, 34, 0, TAU);
  });
  thin(
    ctx,
    (p) => {
      for (const [x, y] of ring(12, 1, 0)) {
        p.moveTo(x * 15, y * 15);
        p.lineTo(x * 31, y * 31);
      }
    },
    0.8,
  );
  part(ctx, (p) => {
    p.arc(0, 0, 10, 0, TAU);
  });
  dot(ctx, 0, 0, 3);
};

const DRAWINGS: Readonly<Record<string, Draw>> = {
  'dome-chill': tarp,
  foret: tower,
  sub: wall,
  'cercle-acid': pylon,
};

function speaker(draw: Draw): Shape {
  return paint(SIZE * FINE, SIZE * FINE, DRAWN_RADIUS * FINE, (ctx) => {
    ctx.scale(FINE, FINE);
    glow(ctx, WHITE, 8 * FINE);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    draw(ctx);
  });
}

export function createSpeakerShapes(): SpeakerShapes {
  return {
    speakers: Object.fromEntries(Object.entries(DRAWINGS).map(([id, draw]) => [id, speaker(draw)])),
    zone: paint(128, 128, 56, (ctx) => {
      ctx.lineCap = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = WHITE;
      ctx.setLineDash([2, 11]);
      circle(ctx, 56);
      ctx.stroke();
    }),
    sweep: paint(SWEEP_LENGTH, 40, SWEEP_LENGTH, (ctx) => {
      ctx.translate(-SWEEP_LENGTH / 2, 0);
      const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, SWEEP_LENGTH);
      fade.addColorStop(0, WHITE);
      fade.addColorStop(1, 'rgb(255 255 255 / 0)');
      ctx.fillStyle = fade;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, SWEEP_LENGTH, -SWEEP_HALF_ANGLE, SWEEP_HALF_ANGLE);
      ctx.closePath();
      ctx.fill();
    }),
  };
}
