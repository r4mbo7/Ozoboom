import type { Container } from 'pixi.js';
import type { DecorId } from '../data/types';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { createButte } from './ground-butte';
import { createFireflies } from './ground-fireflies';
import { type Layout, layoutGround } from './ground-layout';
import { createLake } from './ground-lake';
import { createSand } from './ground-sand';

interface Ground {
  readonly root: Container;
  draw(layout: Layout, seed: number): void;
  style(frame: Frame): void;
  update?(state: SimState, frame: Frame): void;
  destroy(): void;
}

// Only the ground of the stage played is drawn, once per arena and seed, white, then tinted with the hour: only
// the shadows, the reflections and the fireflies move.
export function createGround(ctx: RenderContext): Family {
  const parent = ctx.layers.ground;
  const grounds: Record<DecorId, Ground> = {
    lake: createLake(ctx, parent),
    dome: createSand(parent),
    ambyss: createButte(parent),
  };
  const fireflies = createFireflies(ctx, parent);
  let drawnKey = '';
  let styledAt = Number.NaN;

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      const { arena, seed } = state;
      const { decor } = frame.set;
      const ground = grounds[decor];
      const key = `${String(arena.width)}x${String(arena.height)}:${String(seed)}:${decor}`;
      if (key !== drawnKey) {
        drawnKey = key;
        const layout = layoutGround(seed, arena);
        for (const [id, { root }] of Object.entries(grounds)) {
          root.visible = id === decor;
        }
        ground.draw(layout, seed);
        fireflies.draw(layout, seed);
        styledAt = Number.NaN;
      }
      if (frame.fraction !== styledAt) {
        styledAt = frame.fraction;
        ground.style(frame);
      }
      ground.update?.(state, frame);
      fireflies.update(frame);
    },
    destroy(): void {
      parent.destroy({ children: true });
      for (const ground of Object.values(grounds)) {
        ground.destroy();
      }
    },
  };
}
