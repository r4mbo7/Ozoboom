import { Graphics, type Texture, TilingSprite } from 'pixi.js';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { createFireflies } from './ground-fireflies';
import { SOL_CLAIR_SHARE, layoutGround } from './ground-layout';
import { grainTile, patchTile } from './ground-paint';
import { createTrees } from './ground-trees';
import { createWater } from './ground-water';

const TAU = Math.PI * 2;
const WHITE = 0xffffff;

// Everything still is drawn once per arena and seed, white, then tinted with the hour: only the shadows,
// the reflections and the fireflies move.
export function createGround(ctx: RenderContext): Family {
  const parent = ctx.layers.ground;
  const surface = new Graphics();
  const patches = new TilingSprite();
  const grain = new TilingSprite();
  parent.addChild(surface, patches, grain);
  const water = createWater(ctx, parent);
  const floor = new Graphics();
  const lines = new Graphics();
  const petals = new Graphics();
  const border = new Graphics();
  parent.addChild(floor, lines, petals, border);
  const trees = createTrees(parent);
  const fireflies = createFireflies(ctx, parent);

  let drawnWidth = 0;
  let drawnHeight = 0;
  let drawnSeed = -1;
  let styledAt = Number.NaN;
  let tiles: Texture[] = [];

  function release(): void {
    for (const texture of tiles) {
      texture.destroy(true);
    }
  }

  function draw({ width, height }: { width: number; height: number }, seed: number): void {
    drawnWidth = width;
    drawnHeight = height;
    drawnSeed = seed;
    styledAt = Number.NaN;
    const layout = layoutGround(seed, { width, height });

    surface.clear().rect(0, 0, width, height).fill(WHITE);
    release();
    tiles = [];
    for (const [tiling, texture] of [
      [patches, patchTile(seed)],
      [grain, grainTile(seed)],
    ] as const) {
      tiles.push(texture);
      tiling.texture = texture;
      tiling.width = width;
      tiling.height = height;
    }

    const cx = width / 2;
    const cy = height / 2;
    const radius = layout.floorRadius;
    floor.clear().circle(cx, cy, radius).fill({ color: WHITE, alpha: SOL_CLAIR_SHARE.floor });
    floor.circle(cx, cy, radius).stroke({ width: 3, color: WHITE, alpha: 0.5 });
    lines.clear();
    for (let ring = 1; ring <= 4; ring += 1) {
      lines.circle(cx, cy, (radius * ring) / 4);
    }
    lines.stroke({ width: 2, color: WHITE, alpha: 0.12 });
    petals.clear();
    for (let petal = 0; petal < 12; petal += 1) {
      const angle = (petal / 12) * TAU;
      petals.circle(
        cx + Math.cos(angle) * radius * 0.5,
        cy + Math.sin(angle) * radius * 0.5,
        radius * 0.5,
      );
    }
    petals.stroke({ width: 1.5, color: WHITE, alpha: 0.14 });
    border.clear().rect(0, 0, width, height).stroke({ width: 14, color: WHITE, alpha: 0.08 });
    border.rect(0, 0, width, height).stroke({ width: 3, color: WHITE, alpha: 0.6 });

    water.draw(layout, seed);
    trees.draw(layout);
    fireflies.draw(layout, seed);
  }

  function style(frame: Frame): void {
    const { palette, light } = frame;
    styledAt = frame.fraction;
    surface.tint = palette.solClair;
    surface.alpha = SOL_CLAIR_SHARE.lawn;
    patches.tint = palette.solClair;
    patches.alpha = (SOL_CLAIR_SHARE.tufts - SOL_CLAIR_SHARE.lawn) / 0.5;
    grain.tint = palette.or;
    grain.alpha = light.additive ? 0.16 : 0.24;
    floor.tint = palette.solClair;
    lines.tint = palette.turquoise;
    petals.tint = palette.or;
    border.tint = palette.turquoise;
    water.style(frame);
    trees.style(frame);
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      const { arena, seed } = state;
      if (arena.width !== drawnWidth || arena.height !== drawnHeight || seed !== drawnSeed) {
        draw(arena, seed);
      }
      if (frame.fraction !== styledAt) {
        style(frame);
      }
      water.update(state, frame);
      fireflies.update(frame);
    },
    destroy(): void {
      parent.destroy({ children: true });
      trees.destroy();
      release();
    },
  };
}
