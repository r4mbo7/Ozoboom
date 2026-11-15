import type { UnmaskEffect } from '../data/neon';
import type { EnemyDefinition } from '../data/types';
import { distanceSquared } from '../shared/vec';
import type { ResolvedContent } from './content';
import { lookup } from './lookup';
import type { DancerState, EnemyState, SimState } from './state';

export function unmaskOf(content: ResolvedContent, kind: string): UnmaskEffect {
  const { special } = lookup(content.enemies, kind, 'enemy');
  if (special?.kind !== 'unmask') {
    throw new Error(`the bad vibe "${kind}" leaves no dancer`);
  }
  return special;
}

// 0 without a dancer.
export function lureRadiusOf(state: SimState, content: ResolvedContent): number {
  return state.dancer === undefined ? 0 : unmaskOf(content, state.dancer.kind).lureRadius;
}

// Never a boss nor a shooter: they keep to the core.
export function lures(
  dancer: DancerState | undefined,
  radius: number,
  enemy: EnemyState,
  definition: EnemyDefinition,
): boolean {
  return (
    dancer !== undefined &&
    !enemy.isBoss &&
    definition.ranged === undefined &&
    distanceSquared(enemy, dancer) <= radius * radius
  );
}

// `dancers` puts his mask back on once the hits reach its notches.
export function hitDancer(state: SimState, dancer: DancerState): void {
  dancer.notches += 1;
  state.events.push({ type: 'dancerHit', id: dancer.id, notches: dancer.notches });
}
