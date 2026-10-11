import { CANOPY, ROPE_LENGTH, almondEdge } from './ambyss-layout';
import type { Vec2 } from '../shared/vec';

export type SpiralColor = 'mage' | 'turquoise' | 'or' | 'tank' | 'healer' | 'violet';

export interface Spiral {
  readonly center: Vec2;
  readonly radius: number;
  readonly turns: number;
  readonly width: number;
  readonly clockwise: boolean;
  readonly color: SpiralColor;
}

export interface Curve {
  readonly from: Vec2;
  readonly control: Vec2;
  readonly to: Vec2;
}

export interface CanopyLayout {
  readonly anchors: readonly Vec2[];
  readonly scallops: readonly Omit<Curve, 'from'>[];
  readonly masts: readonly [Vec2, Vec2];
  readonly seams: readonly Curve[];
  readonly ropes: readonly { from: Vec2; to: Vec2; angle: number }[];
  readonly spirals: readonly Spiral[];
}

// The mock-up's sail spans 392 x 232 around its core: its drawing is scaled to the canopy.
export const SCALE_X = CANOPY.halfWidth / 392;
export const SCALE_Y = CANOPY.halfHeight / 232;
const SPANS_PER_ARC = 7;
const SCALLOP = 0.16;
const MAST_SPREAD = 190;
const SEAM_SAG = 12;
const ROPE_SPLAY = 0.12;
// Ropes fan out flatter than the almond, so the pegs of the long sides spread along the slope.
const ROPE_FLATTEN = 1.6;
const SPIRAL_STRETCH = 1.4;
const SPIRAL_STEPS_PER_TURN = 40;

const SPIRALS: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
  boolean,
  SpiralColor,
])[] = [
  [-180, -50, 2.4, 150, 16, true, 'mage'],
  [190, 50, 2.6, 160, 16, false, 'turquoise'],
  [10, -120, 1.6, 90, 12, true, 'or'],
  [-40, 130, 1.8, 100, 12, false, 'tank'],
  [330, -70, 1.4, 70, 10, true, 'violet'],
  [-330, 70, 1.4, 70, 10, false, 'healer'],
];

export function canopyLayout(center: Vec2): CanopyLayout {
  const anchors: Vec2[] = [
    { x: center.x - CANOPY.halfWidth, y: center.y },
    { x: center.x + CANOPY.halfWidth, y: center.y },
  ];
  for (const north of [true, false]) {
    for (let span = 1; span < SPANS_PER_ARC; span += 1) {
      anchors.push(almondEdge(center, CANOPY, span / SPANS_PER_ARC, north));
    }
  }
  const bearing = ({ x, y }: Vec2) => Math.atan2(y - center.y, x - center.x);
  anchors.sort((a, b) => bearing(a) - bearing(b));

  const scallops = anchors.map((from, index) => {
    const to = anchors[(index + 1) % anchors.length] ?? from;
    const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    return {
      control: {
        x: middle.x + (center.x - middle.x) * SCALLOP,
        y: middle.y + (center.y - middle.y) * SCALLOP,
      },
      to,
    };
  });

  const masts: [Vec2, Vec2] = [
    { x: center.x - MAST_SPREAD * SCALE_X, y: center.y },
    { x: center.x + MAST_SPREAD * SCALE_X, y: center.y },
  ];
  const seams = anchors.map((to) => {
    const from = to.x < center.x ? masts[0] : masts[1];
    const sag = (to.y < center.y ? SEAM_SAG : -SEAM_SAG) * SCALE_Y;
    return { from, control: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 + sag }, to };
  });

  const ropes = anchors.flatMap((from) => {
    const out = Math.atan2((from.y - center.y) * ROPE_FLATTEN, from.x - center.x);
    return [out - ROPE_SPLAY, out + ROPE_SPLAY].map((angle) => ({
      from,
      to: { x: from.x + ROPE_LENGTH * Math.cos(angle), y: from.y + ROPE_LENGTH * Math.sin(angle) },
      angle: out,
    }));
  });

  const spirals = SPIRALS.map(([dx, dy, turns, radius, width, clockwise, color]) => ({
    center: { x: center.x + dx * SCALE_X, y: center.y + dy * SCALE_Y },
    radius: radius * SCALE_X,
    turns,
    width: width * SCALE_X,
    clockwise,
    color,
  }));

  return { anchors, scallops, masts, seams, ropes, spirals };
}

export function spiralPoints(spiral: Spiral): Vec2[] {
  const steps = Math.round(spiral.turns * SPIRAL_STEPS_PER_TURN);
  const direction = spiral.clockwise ? 1 : -1;
  return Array.from({ length: steps + 1 }, (_, step) => {
    const angle = (direction * step * Math.PI * 2) / SPIRAL_STEPS_PER_TURN;
    const radius = (spiral.radius * step) / steps;
    return {
      x: spiral.center.x + radius * Math.cos(angle) * SPIRAL_STRETCH,
      y: spiral.center.y + radius * Math.sin(angle),
    };
  });
}
