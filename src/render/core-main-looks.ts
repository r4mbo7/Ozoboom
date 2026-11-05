import { lerp } from '../shared/scalar';
import {
  DOME_LOOK,
  QUARTER_TURN,
  RIM,
  doubleRim,
  eased,
  fillDisc,
  fraction,
  kick,
  softLight,
  strokeDisc,
  type CoreLook,
  type CoreLayer,
  type LayerMove,
} from './core-look';
import { TAU, WHITE, polygon, type Ctx } from './paint';

const rock = (beats: number): number => Math.cos((beats / 16) * TAU) * 0.05;

function petal(ctx: Ctx, from: number, to: number, width: number): void {
  const length = to - from;
  ctx.beginPath();
  ctx.moveTo(from, 0);
  ctx.bezierCurveTo(from + length * 0.2, -width * 1.4, from + length * 0.66, -width * 0.8, to, 0);
  ctx.bezierCurveTo(from + length * 0.66, width * 0.8, from + length * 0.2, width * 1.4, from, 0);
  ctx.closePath();
}

interface Crown {
  readonly count: number;
  readonly turn: number;
  readonly from: number;
  readonly to: number;
  readonly width: number;
  readonly deep: string;
  readonly bright: string;
  readonly line: string;
  readonly lineWidth: number;
}

function eachPetal(ctx: Ctx, crown: Crown, draw: () => void): void {
  for (let index = 0; index < crown.count; index += 1) {
    ctx.save();
    ctx.rotate(crown.turn - QUARTER_TURN + (index / crown.count) * TAU);
    draw();
    ctx.restore();
  }
}

function crownDraw(crown: Crown): (ctx: Ctx) => void {
  return (ctx) => {
    eachPetal(ctx, crown, () => {
      const fill = ctx.createLinearGradient(crown.from, 0, crown.to, 0);
      fill.addColorStop(0, crown.deep);
      fill.addColorStop(1, crown.bright);
      petal(ctx, crown.from, crown.to, crown.width);
      ctx.strokeStyle = 'rgb(6 4 22 / 0.8)';
      ctx.lineWidth = crown.lineWidth + 2.4;
      ctx.stroke();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = crown.line;
      ctx.lineWidth = crown.lineWidth;
      ctx.stroke();
      ctx.strokeStyle = '#1a0830';
      ctx.lineWidth = crown.lineWidth * 0.36;
      ctx.stroke();
    });
  };
}

function veins(crown: Crown): (ctx: Ctx) => void {
  return (ctx) => {
    eachPetal(ctx, crown, () => {
      const length = crown.to - crown.from;
      ctx.beginPath();
      ctx.moveTo(crown.from + length * 0.5, 0);
      ctx.lineTo(crown.from + length * 0.82, 0);
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });
  };
}

function opening(reach: number, delay: number): LayerMove {
  return (sprite, beats) => {
    sprite.rotation = rock(beats);
    sprite.scale.set(1 + reach * kick(beats, 4, delay));
  };
}

const OUTER_CROWN: Crown = {
  count: 10,
  turn: 0,
  from: RIM * 0.28,
  to: RIM * 0.92,
  width: RIM * 0.19,
  deep: '#2a0a4a',
  bright: '#a3288c',
  line: '#ff6fa8',
  lineWidth: 3.2,
};
const MIDDLE_CROWN: Crown = {
  count: 10,
  turn: TAU / 20,
  from: RIM * 0.16,
  to: RIM * 0.66,
  width: RIM * 0.135,
  deep: '#3c0e58',
  bright: '#d13f95',
  line: '#ff8fbd',
  lineWidth: 2.6,
};
const INNER_CROWN: Crown = {
  count: 5,
  turn: 0,
  from: RIM * 0.1,
  to: RIM * 0.44,
  width: RIM * 0.15,
  deep: '#5a1464',
  bright: '#ec5a9c',
  line: '#ffa6c9',
  lineWidth: 2.2,
};
const OUTER_OPENS = opening(0.048, 0.16);

function stamens(ctx: Ctx): void {
  for (let index = 0; index < 15; index += 1) {
    const angle = (index / 15) * TAU - QUARTER_TURN;
    const [x, y] = [Math.cos(angle), Math.sin(angle)];
    ctx.beginPath();
    ctx.moveTo(x * RIM * 0.15, y * RIM * 0.15);
    ctx.lineTo(x * RIM * 0.25, y * RIM * 0.25);
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 1;
    ctx.stroke();
    fillDisc(ctx, 1.2, '#f5e663', x * RIM * 0.25, y * RIM * 0.25);
  }
}

function lotusHeart(ctx: Ctx): void {
  fillDisc(ctx, RIM * 0.17, WHITE);
  strokeDisc(ctx, RIM * 0.17, '#071022', 1.6);
  ctx.globalAlpha = 0.4;
  fillDisc(ctx, 1.3, '#071022');
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * TAU - QUARTER_TURN;
    fillDisc(ctx, 1.3, '#071022', Math.cos(angle) * RIM * 0.098, Math.sin(angle) * RIM * 0.098);
  }
}

const LOTUS_LOOK: CoreLook = {
  id: 'lotus',
  layers: [
    {
      draw: (ctx) => {
        fillDisc(ctx, RIM, '#08291f');
        strokeDisc(ctx, RIM * 0.985, '#2f7a5a', 1.2);
      },
    },
    { draw: crownDraw(OUTER_CROWN), move: OUTER_OPENS },
    { draw: veins(OUTER_CROWN), life: true, move: OUTER_OPENS },
    { draw: crownDraw(MIDDLE_CROWN), move: opening(0.09, 0.08) },
    { draw: crownDraw(INNER_CROWN), move: opening(0.18, 0) },
    {
      draw: softLight(RIM * 0.55),
      reach: RIM * 0.56,
      life: true,
      light: true,
      move: (sprite, beats) => {
        sprite.alpha = 0.32 + 0.35 * kick(beats);
      },
    },
    { draw: stamens, reach: RIM * 0.3, move: opening(0.12, 0) },
    { draw: lotusHeart, reach: RIM * 0.2, life: true },
    { draw: softLight(RIM * 0.11), reach: RIM * 0.12 },
  ],
};

const TRIANGLES = 4;
const TRIANGLE_INSET = 0.22;
const TEMPLE_RIM = RIM * 0.9;
const TEMPLE_GOLD = '#f2bd58';
const TEMPLE_DARK = '#140b06';
const TEMPLE_PLATES = ['#6b4516', '#3c2410', '#7d5419', '#472b11'];

type Point = readonly [number, number];
type Triangle = readonly [Point, Point, Point];

function firstTriangle(radius: number): Triangle {
  const corner = (index: number): Point => {
    const angle = -QUARTER_TURN + (index / 3) * TAU;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  };
  return [corner(0), corner(1), corner(2)];
}

function insetTriangle([a, b, c]: Triangle): Triangle {
  const along = (from: Point, to: Point): Point => [
    lerp(from[0], to[0], TRIANGLE_INSET),
    lerp(from[1], to[1], TRIANGLE_INSET),
  ];
  return [along(a, b), along(b, c), along(c, a)];
}

function nestedTriangles(radius: number): readonly Triangle[] {
  let triangle = firstTriangle(radius);
  const nested = [triangle];
  while (nested.length < TRIANGLES) {
    triangle = insetTriangle(triangle);
    nested.push(triangle);
  }
  return nested;
}

const NESTED_TRIANGLES = nestedTriangles(TEMPLE_RIM * 0.98);

const triangleWidth = (level: number): number => 2.2 + 0.4 * (TRIANGLES - level);

function templeBase(ctx: Ctx): void {
  fillDisc(ctx, RIM, TEMPLE_DARK);
  fillDisc(ctx, TEMPLE_RIM, '#170d13');
  NESTED_TRIANGLES.forEach((triangle, level) => {
    polygon(ctx, triangle);
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = TEMPLE_DARK;
    ctx.lineWidth = triangleWidth(level) + 2;
    ctx.stroke();
    ctx.fillStyle = TEMPLE_PLATES[level] ?? TEMPLE_DARK;
    ctx.fill();
    ctx.strokeStyle = TEMPLE_GOLD;
    ctx.lineWidth = triangleWidth(level);
    ctx.stroke();
  });
  doubleRim(ctx, TEMPLE_RIM, TEMPLE_GOLD, TEMPLE_DARK, 4.4);
}

function templeLight(triangle: Triangle, level: number): CoreLayer {
  return {
    draw: (ctx) => {
      polygon(ctx, triangle);
      ctx.fillStyle = 'rgb(255 255 255 / 0.3)';
      ctx.fill();
      ctx.lineJoin = 'miter';
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = triangleWidth(level);
      ctx.stroke();
    },
    life: true,
    move: (sprite, beats) => {
      const since = fraction((beats - (TRIANGLES - 1 - level)) / 4) * 4;
      sprite.alpha = Math.min(1, eased(since / 0.1) * Math.exp(-1.25 * since) * 1.25);
    },
  };
}

const TRIANGLE_LOOK: CoreLook = {
  id: 'triangle',
  layers: [
    { draw: templeBase },
    ...NESTED_TRIANGLES.map(templeLight),
    {
      draw: softLight(13),
      reach: 14,
      life: true,
      light: true,
      move: (sprite, beats) => {
        sprite.alpha = 0.7 + 0.3 * kick(beats);
      },
    },
    {
      draw: (ctx) => {
        fillDisc(ctx, 3.8, WHITE);
        strokeDisc(ctx, 3.8, TEMPLE_DARK, 1.2);
      },
      reach: 6,
      life: true,
    },
    {
      draw: (ctx) => {
        fillDisc(ctx, 1.4, '#fff6df');
      },
      reach: 3,
    },
  ],
};

export const MAIN_CORE_LOOKS: readonly CoreLook[] = [DOME_LOOK, LOTUS_LOOK, TRIANGLE_LOOK];
