import type { Container } from 'pixi.js';
import type { DecorId } from '../data/types';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { FULL_LOOKS } from './full';
import { createFireflies } from './ground-fireflies';
import { type Layout, layoutGround } from './ground-layout';
import { createLake } from './ground-lake';

export interface Ground {
  readonly root: Container;
  draw(layout: Layout, seed: number): void;
  style(frame: Frame): void;
  update?(state: SimState, frame: Frame): void;
  destroy(): void;
}

// What a stage beyond the main one brings to the scene: its ground, and the families of its decor, which show
// only at the stages of that decor.
export interface StageLook {
  readonly decor: DecorId;
  ground(parent: Container): Ground;
  families(ctx: RenderContext): Family[];
}

// Only the ground of the stage played is drawn, once per arena and seed, white, then tinted with the hour: only
// the shadows, the reflections and the fireflies move.
export function createGround(ctx: RenderContext): Family {
  const parent = ctx.layers.ground;
  const grounds = new Map<DecorId, Ground>([
    ['lake', createLake(ctx, parent)],
    ...FULL_LOOKS.map((look): [DecorId, Ground] => [look.decor, look.ground(parent)]),
  ]);
  const fireflies = createFireflies(ctx, parent);
  let drawnKey = '';
  let styledAt = Number.NaN;

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      const { arena, seed } = state;
      const { decor } = frame.set;
      const ground = grounds.get(decor);
      if (ground === undefined) {
        throw new Error(`No ground for the decor ${decor}`);
      }
      const key = `${String(arena.width)}x${String(arena.height)}:${String(seed)}:${decor}`;
      if (key !== drawnKey) {
        drawnKey = key;
        const layout = layoutGround(seed, arena);
        for (const [id, { root }] of grounds) {
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
      for (const ground of grounds.values()) {
        ground.destroy();
      }
    },
  };
}
