import { Container, Graphics, Sprite, type Texture, TilingSprite } from 'pixi.js';
import { hillAt } from '../shared/palette';
import { nextFloat, seedRng } from '../shared/prng';
import { FLOOR, SCALE, almondEdge, insideAlmond } from './ambyss-layout';
import { type Seat, groveOf, seatsOf } from './butte-layout';
import type { Vec2 } from '../shared/vec';
import type { Frame } from './frame';
import { type Layout, OVERFLOW } from './ground-layout';
import { sandTile, softDisc } from './ground-paint';
import { createTrees } from './ground-trees';
import { parseHexColor } from './palette';

const TAU = Math.PI * 2;
const WHITE = 0xffffff;
const BLACK = 0x000000;
const CONTOURS = 9;
const LAND_RESOLUTION = 0.5;
const CONTOUR_SEGMENTS = 240;
const TUFT_DENSITY = 2.4e-4;
const EDGE_POINTS = 48;
const CORNER_STEPS = 3;
const CUSHION = { halfWidth: 6 * SCALE, halfHeight: 4.5 * SCALE, corner: 3 * SCALE } as const;
// Wide strokes laid one over the other, from the widest and faintest: a soft edge without a filter.
const SOFT = [
  [20, 0.12],
  [10, 0.16],
  [0, 0.3],
] as const;

function almondPath(graphics: Graphics, center: Vec2): Graphics {
  for (const north of [true, false]) {
    for (let step = 0; step <= EDGE_POINTS; step += 1) {
      const t = north ? step / EDGE_POINTS : 1 - step / EDGE_POINTS;
      const { x, y } = almondEdge(center, FLOOR, t, north);
      if (north && step === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    }
  }
  return graphics.closePath();
}

// A rounded rectangle turned with the seat, as a plain convex outline.
function cushionOutline({ x, y, angle }: Seat): number[] {
  const { halfWidth, halfHeight, corner } = CUSHION;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const points: number[] = [];
  for (const [quarter, u, v] of [
    [0, 1, 1],
    [1, -1, 1],
    [2, -1, -1],
    [3, 1, -1],
  ] as const) {
    for (let step = 0; step <= CORNER_STEPS; step += 1) {
      const turn = ((quarter + step / CORNER_STEPS) * Math.PI) / 2;
      const a = u * (halfWidth - corner) + Math.cos(turn) * corner;
      const b = v * (halfHeight - corner) + Math.sin(turn) * corner;
      points.push(x + a * cos - b * sin, y + a * sin + b * cos);
    }
  }
  return points;
}

// The hill of Ambyss: dry grass on its slope, sand at its summit, wobbly contour lines around the floor, two
// trodden paths from its tips, trees at its foot, the light of the east, and red cushions on the almond floor.
// Drawn white once per arena and seed, tinted with the hour.
export function createButte(parent: Container) {
  const root = new Container();
  const disc = softDisc();
  const surface = new Graphics();
  const slope = new Sprite(disc.texture);
  const summit = new Sprite(disc.texture);
  const east = new Sprite(disc.texture);
  const tufts = new Graphics();
  const contours = new Graphics();
  const grain = new TilingSprite();
  const paths = new Graphics();
  for (const blur of [slope, summit, east]) {
    blur.anchor.set(0.5);
  }
  const grove = new Container();
  // The land under the hill is all soft colour: baked at low density each time the hour tints it, a frame draws it
  // as one sprite instead of four layers as wide as the screen.
  const land = new Container();
  land.addChild(surface, slope, summit, east);
  land.cacheAsTexture({ resolution: LAND_RESOLUTION });
  root.addChild(land, tufts, contours, grain, paths, grove);
  const trees = createTrees(grove);
  const floor = new Graphics();
  const rim = new Graphics();
  const cushions = new Graphics();
  const crowd = new Graphics();
  root.addChild(floor, rim, cushions, crowd);
  parent.addChild(root);
  let tile: Texture | null = null;

  function release(): void {
    tile?.destroy(true);
    tile = null;
  }

  return {
    root,
    draw(layout: Layout, seed: number): void {
      const { width, height } = layout.arena;
      const center = { x: width / 2, y: height / 2 };
      const rng = seedRng((seed + 5113) >>> 0);
      const span = { x: width + 2 * OVERFLOW, y: height + 2 * OVERFLOW };

      surface.clear().rect(-OVERFLOW, -OVERFLOW, span.x, span.y).fill(WHITE);
      const ellipse = (sprite: Sprite, x: number, y: number, rx: number, ry: number) => {
        sprite.position.set(x, y);
        sprite.scale.set(rx / disc.radius, ry / disc.radius);
      };
      ellipse(slope, center.x, center.y, 520 * SCALE, 360 * SCALE);
      ellipse(summit, center.x, center.y, 430 * SCALE, 280 * SCALE);
      ellipse(east, width + 20 * SCALE, center.y - 30 * SCALE, 420 * SCALE, 560 * SCALE);

      tufts.clear();
      const tuftCount = Math.round(span.x * span.y * TUFT_DENSITY);
      for (let index = 0; index < tuftCount; index += 1) {
        const x = -OVERFLOW + nextFloat(rng) * span.x;
        const y = -OVERFLOW + nextFloat(rng) * span.y;
        if (insideAlmond(center, FLOOR, { x, y }, 70 * SCALE)) {
          continue;
        }
        tufts
          .moveTo(x - 3 * SCALE, y - 4 * SCALE)
          .lineTo(x, y + 2 * SCALE)
          .lineTo(x + 4 * SCALE, y - 5 * SCALE);
      }
      tufts.stroke({ width: 1.3 * SCALE, color: WHITE, cap: 'round', join: 'round' });

      const phases = Array.from({ length: 4 }, () => nextFloat(rng) * TAU);
      const [p0 = 0, p1 = 0, p2 = 0, p3 = 0] = phases;
      const wobble = (x: number, y: number): Vec2 => ({
        x:
          (11 * Math.sin(0.006 * x + 0.8 * Math.cos(0.005 * y) + p0) +
            5 * Math.sin(0.013 * y + p1)) *
          SCALE,
        y:
          (11 * Math.sin(0.007 * y + 0.8 * Math.cos(0.006 * x) + p2) +
            5 * Math.sin(0.011 * x + p3)) *
          SCALE,
      });
      contours.clear();
      for (let ring = 0; ring < CONTOURS; ring += 1) {
        const cx = center.x + ring * 5 * SCALE;
        const cy = center.y + ring * 4 * SCALE;
        const rx = FLOOR.halfWidth + (70 + ring * 62) * SCALE;
        const ry = FLOOR.halfHeight + (66 + ring * 56) * SCALE;
        for (let step = 0; step <= CONTOUR_SEGMENTS; step += 1) {
          const angle = (step / CONTOUR_SEGMENTS) * TAU;
          const x = cx + Math.cos(angle) * rx;
          const y = cy + Math.sin(angle) * ry;
          const shift = wobble(x, y);
          if (step === 0) {
            contours.moveTo(x + shift.x, y + shift.y);
          } else {
            contours.lineTo(x + shift.x, y + shift.y);
          }
        }
      }
      contours.stroke({ width: 1.7 * SCALE, color: WHITE });

      release();
      tile = sandTile(seed);
      grain.texture = tile;
      grain.position.set(-OVERFLOW);
      grain.tilePosition.set(OVERFLOW);
      grain.width = span.x;
      grain.height = span.y;

      paths.clear();
      for (const side of [-1, 1]) {
        const tip = center.x + side * FLOOR.halfWidth;
        const far = side < 0 ? -OVERFLOW : width + OVERFLOW;
        for (const [extra, alpha] of SOFT) {
          paths
            .moveTo(tip, center.y)
            .bezierCurveTo(
              tip + side * 120 * SCALE,
              center.y - side * 10 * SCALE,
              center.x + side * 480 * SCALE,
              center.y - side * 50 * SCALE,
              far,
              center.y - side * 80 * SCALE,
            )
            .stroke({ width: 24 * SCALE + extra, color: WHITE, alpha, cap: 'round' });
        }
      }

      trees.draw(groveOf(layout.arena, seed));

      almondPath(floor.clear(), center).fill(WHITE);
      rim.clear();
      for (const [extra, alpha] of SOFT) {
        almondPath(rim, center).stroke({ width: 26 * SCALE + extra - 10, color: WHITE, alpha });
      }

      cushions.clear();
      crowd.clear();
      for (const seat of seatsOf(center, seed)) {
        cushions
          .poly(cushionOutline(seat))
          .fill(WHITE)
          .stroke({ width: 0.8 * SCALE, color: BLACK, alpha: 0.3 });
        if (seat.festivalGoer !== null) {
          crowd
            .circle(seat.x, seat.y, 4 * SCALE)
            .fill(seat.festivalGoer)
            .stroke({ width: SCALE, color: BLACK, alpha: 0.3 });
        }
      }
    },
    style(frame: Frame): void {
      const hill = hillAt(frame.fraction);
      const sable = parseHexColor(hill.sable);
      const clair = parseHexColor(hill.sableClair);
      const courbe = parseHexColor(hill.courbe);
      surface.tint = parseHexColor(hill.herbe);
      slope.tint = parseHexColor(hill.herbeClaire);
      summit.tint = sable;
      east.tint = parseHexColor(hill.soleil);
      east.alpha = hill.est;
      land.updateCacheTexture();
      tufts.tint = courbe;
      tufts.alpha = 0.55;
      contours.tint = courbe;
      contours.alpha = 0.8;
      grain.tint = courbe;
      grain.alpha = 0.35;
      paths.tint = clair;
      floor.tint = clair;
      rim.tint = sable;
      cushions.tint = parseHexColor(hill.coussin);
      trees.style(frame, {
        leaf: parseHexColor(hill.arbre),
        rim: parseHexColor(hill.arbreClair),
        rimAlpha: 0.55,
      });
    },
    destroy(): void {
      release();
      trees.destroy();
      disc.texture.destroy(true);
    },
  };
}
