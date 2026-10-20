import type { Container } from 'pixi.js';
import type { DecorId, SetDefinition } from '../data/types';
import type { SimState } from '../sim/state';
import type { Family, RenderContext } from './context';
import type { Frame } from './frame';
import { FULL_CLEARINGS, FULL_LOOKS } from './full';
import { releaseDrawing } from './util';
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
  // Each ground keeps what it last drew: the one a festival walks toward is drawn ahead, unseen.
  const drawn = new Map<DecorId, string>();
  let shownKey = '';
  let styledAt = Number.NaN;

  function groundOf(decor: DecorId): Ground {
    const ground = grounds.get(decor);
    if (ground === undefined) {
      throw new Error(`No ground for the decor ${decor}`);
    }
    return ground;
  }

  // A festival keeps its exits clear of trees.
  function layoutOf(set: SetDefinition, state: SimState): Layout {
    const clearings = state.festival === undefined ? [] : (FULL_CLEARINGS[set.id] ?? []);
    return layoutGround(state.seed, set.arena, clearings);
  }

  function drawAhead(set: SetDefinition, state: SimState, layout?: Layout): void {
    const key = `${set.id}:${String(state.seed)}:${String(state.festival !== undefined)}`;
    if (drawn.get(set.decor) !== key) {
      drawn.set(set.decor, key);
      groundOf(set.decor).draw(layout ?? layoutOf(set, state), state.seed);
    }
  }

  return {
    update(state: SimState, _alpha: number, frame: Frame): void {
      const { seed } = state;
      const { set, upcoming } = frame;
      const { decor } = set;
      const ground = groundOf(decor);
      if (upcoming !== undefined && upcoming.decor !== decor) {
        drawAhead(upcoming, state);
      }
      // A festival leaves stages behind: their grounds give their shapes back until they come again.
      for (const [left, key] of drawn) {
        if (key !== '' && left !== decor && left !== upcoming?.decor) {
          releaseDrawing(groundOf(left).root);
          drawn.set(left, '');
        }
      }
      const key = `${set.id}:${String(seed)}:${String(state.festival !== undefined)}`;
      if (key !== shownKey) {
        shownKey = key;
        const layout = layoutOf(set, state);
        drawAhead(set, state, layout);
        for (const [id, { root }] of grounds) {
          root.visible = id === decor;
        }
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
