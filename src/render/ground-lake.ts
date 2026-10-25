import { Container, Graphics, type Texture, TilingSprite } from 'pixi.js';
import type { SimState } from '../sim/state';
import type { RenderContext } from './context';
import type { Frame } from './frame';
import { type Layout, OVERFLOW, SOL_CLAIR_SHARE } from './ground-layout';
import { grainTile, patchTile } from './ground-paint';
import { createTrees } from './ground-trees';
import { createWater } from './ground-water';

const TAU = Math.PI * 2;
const WHITE = 0xffffff;

export function createLake(ctx: RenderContext, parent: Container) {
  const root = new Container();
  parent.addChild(root);
  const surface = new Graphics();
  const patches = new TilingSprite();
  const grain = new TilingSprite();
  root.addChild(surface, patches, grain);
  const water = createWater(ctx, root);
  const floor = new Graphics();
  const lines = new Graphics();
  const petals = new Graphics();
  const border = new Graphics();
  root.addChild(floor, lines, petals, border);
  const trees = createTrees(root);
  let tiles: Texture[] = [];

  function release(): void {
    for (const texture of tiles) {
      texture.destroy(true);
    }
    tiles = [];
  }

  return {
    root,
    draw(layout: Layout, seed: number): void {
      const { width, height } = layout.arena;
      surface
        .clear()
        .rect(-OVERFLOW, -OVERFLOW, width + 2 * OVERFLOW, height + 2 * OVERFLOW)
        .fill(WHITE);
      release();
      for (const [tiling, texture] of [
        [patches, patchTile(seed)],
        [grain, grainTile(seed)],
      ] as const) {
        tiles.push(texture);
        tiling.texture = texture;
        tiling.position.set(-OVERFLOW);
        tiling.tilePosition.set(OVERFLOW);
        tiling.width = width + 2 * OVERFLOW;
        tiling.height = height + 2 * OVERFLOW;
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
      trees.draw(layout.trees);
    },
    style(frame: Frame): void {
      const { palette, light } = frame;
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
    },
    update(state: SimState, frame: Frame): void {
      water.update(state, frame);
    },
    destroy(): void {
      trees.destroy();
      release();
    },
  };
}
