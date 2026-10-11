import type { SetDefinition } from '../data/types';
import { createAmbyss } from './ambyss';
import type { Family, RenderContext } from './context';
import { createDome } from './dome';

// The decors laid in the decor layer, under the fight: each shows only at the stages of its own decor.
export function createDecors(
  ctx: RenderContext,
  sets: ReadonlyMap<string, SetDefinition>,
): Family[] {
  return [createDome(ctx, sets), createAmbyss(ctx, sets)];
}
