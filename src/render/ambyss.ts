import { Container, Graphics } from 'pixi.js';
import type { SetDefinition } from '../data/types';
import { type SunMoment, canopyAt, spanAt } from '../shared/palette';
import type { SimState } from '../sim/state';
import {
  type Curve,
  SCALE_X,
  type SpiralColor,
  canopyLayout,
  spiralPoints,
} from './ambyss-canopy-layout';
import type { Family, RenderContext } from './context';
import type { Point } from './dome-layout';
import type { Frame } from './frame';
import { parseHexColor } from './palette';
import { setTint } from './util';

const WHITE = 0xffffff;
const BLACK = 0x000000;
const SPIRAL_COLORS: readonly SpiralColor[] = [
  'mage',
  'turquoise',
  'or',
  'tank',
  'healer',
  'violet',
];
// Widths of the layered strokes that blur a painted spiral's edge, as the mock-up's soft filter does.
const SOFT_STROKES = [2, 1.6, 1.25, 0.9, 0.6];
// How much of the sail and of its paint shows at each moment: the paint only glows in the dark.
const SHOWING: Record<SunMoment, { sail: number; paint: number }> = {
  crepuscule: { sail: 0.2, paint: 0.17 },
  nuit: { sail: 0.16, paint: 0.32 },
  aube: { sail: 0.22, paint: 0.04 },
  jour: { sail: 0.24, paint: 0 },
};

function scalloped(
  shape: Graphics,
  anchors: readonly Point[],
  spans: readonly Omit<Curve, 'from'>[],
) {
  const [first] = anchors;
  if (first === undefined) {
    return shape;
  }
  shape.moveTo(first.x, first.y);
  for (const { control, to } of spans) {
    shape.quadraticCurveTo(control.x, control.y, to.x, to.y);
  }
  return shape.closePath();
}

// The decor of a stage with `decor: 'ambyss'`: a stretched sail on two masts, laid very translucent over the
// fight, guy ropes down to pegs on the slope, painted spirals that glow at night. Drawn once white, then tinted.
export function createAmbyss(ctx: RenderContext, sets: ReadonlyMap<string, SetDefinition>): Family {
  const root = new Container();
  ctx.layers.decor.addChild(root);
  const ropes = new Graphics();
  const pegs = new Graphics();
  const sail = new Graphics();
  const clip = new Graphics();
  const paint = new Container();
  const spirals = SPIRAL_COLORS.map(() => new Graphics());
  const seams = new Graphics();
  const edge = new Graphics();
  const masts = new Graphics();
  const lights = new Graphics();
  paint.addChild(...spirals);
  paint.mask = clip;
  root.addChild(ropes, pegs, sail, clip, paint, seams, edge, masts, lights);

  let drawnId = '';
  let styledAt = Number.NaN;

  function draw(set: SetDefinition): void {
    const center = { x: set.arena.width / 2, y: set.arena.height / 2 };
    const canopy = canopyLayout(center);

    ropes.clear();
    pegs.clear();
    const peg = 4 * SCALE_X;
    for (const rope of canopy.ropes) {
      ropes.moveTo(rope.from.x, rope.from.y).lineTo(rope.to.x, rope.to.y);
      const along = { x: Math.cos(rope.angle) * peg, y: Math.sin(rope.angle) * peg };
      pegs.poly([
        rope.to.x + along.x - along.y,
        rope.to.y + along.y + along.x,
        rope.to.x - along.x - along.y,
        rope.to.y - along.y + along.x,
        rope.to.x - along.x + along.y,
        rope.to.y - along.y - along.x,
        rope.to.x + along.x + along.y,
        rope.to.y + along.y - along.x,
      ]);
    }
    ropes.stroke({ width: 1.4 * SCALE_X, color: WHITE, alpha: 0.85 });
    pegs.fill(WHITE).stroke({ width: 1, color: BLACK, alpha: 0.35 });

    sail.clear();
    scalloped(sail, canopy.anchors, canopy.scallops).fill(WHITE);
    clip.clear();
    scalloped(clip, canopy.anchors, canopy.scallops).fill(WHITE);

    for (const [index, shape] of spirals.entries()) {
      shape.clear();
      for (const spiral of canopy.spirals.filter(({ color }) => color === SPIRAL_COLORS[index])) {
        // Segments shorter than the brush at the very heart of a spiral would spike its joins.
        const points = spiralPoints(spiral)
          .filter(
            ({ x, y }) => Math.hypot(x - spiral.center.x, y - spiral.center.y) >= spiral.width / 2,
          )
          .flatMap(({ x, y }) => [x, y]);
        for (const soft of SOFT_STROKES) {
          shape.poly(points, false);
          shape.stroke({
            width: spiral.width * soft,
            color: WHITE,
            alpha: 0.16,
            cap: 'round',
            join: 'round',
          });
        }
      }
    }

    seams.clear();
    for (const seam of canopy.seams) {
      seams.moveTo(seam.from.x, seam.from.y);
      seams.quadraticCurveTo(seam.control.x, seam.control.y, seam.to.x, seam.to.y);
    }
    seams.stroke({ width: SCALE_X, color: WHITE, alpha: 0.55 });
    const [west, east] = canopy.masts;
    seams.moveTo(west.x, west.y).lineTo(east.x, east.y);
    seams.stroke({ width: 1.6 * SCALE_X, color: WHITE, alpha: 0.55 });

    edge.clear();
    scalloped(edge, canopy.anchors, canopy.scallops).stroke({
      width: 2.2 * SCALE_X,
      color: WHITE,
      alpha: 0.9,
    });

    masts.clear();
    lights.clear();
    for (const mast of canopy.masts) {
      masts.circle(mast.x, mast.y, 8 * SCALE_X).fill(WHITE);
      masts.circle(mast.x, mast.y, 8 * SCALE_X).stroke({ width: 1.2, color: BLACK, alpha: 0.4 });
      lights.circle(mast.x, mast.y, 3 * SCALE_X).fill(WHITE);
    }
  }

  function style(frame: Frame): void {
    const { palette, light } = frame;
    styledAt = frame.fraction;
    const canopy = canopyAt(frame.fraction);
    const toile = parseHexColor(canopy.toile);
    const corde = parseHexColor(canopy.corde);
    const { from, to, mix } = spanAt(frame.fraction);
    const showing = (key: 'sail' | 'paint') =>
      SHOWING[from][key] + (SHOWING[to][key] - SHOWING[from][key]) * mix;
    const mode = light.additive ? 'add' : 'normal';

    setTint(sail, toile);
    sail.alpha = showing('sail');
    paint.alpha = showing('paint');
    paint.visible = paint.alpha > 0;
    for (const [index, shape] of spirals.entries()) {
      const color = SPIRAL_COLORS[index] ?? 'violet';
      setTint(shape, color === 'violet' ? parseHexColor(canopy.violet) : palette[color]);
      shape.blendMode = mode;
    }
    for (const shape of [ropes, pegs, seams, edge, masts]) {
      setTint(shape, corde);
    }
    setTint(lights, palette.noyau);
    lights.blendMode = mode;
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      const set = sets.get(state.setId);
      root.visible = set?.decor === 'ambyss';
      if (!root.visible || set === undefined) {
        return;
      }
      if (set.id !== drawnId) {
        drawnId = set.id;
        draw(set);
      }
      if (frame.fraction !== styledAt) {
        style(frame);
      }
    },
    destroy(): void {
      root.destroy({ children: true });
    },
  };
}
