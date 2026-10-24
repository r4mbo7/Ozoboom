import { touches } from '../effects';
import { RING_SIZE, turnRing } from '../rings';
import type { SpecialModule } from './types';
import type { EnemyState, SimState } from '../state';

// Members farther than this many reaches from the boss have lost the ring.
const LOST_REACHES = 1;

// A taunt this tick sets the target of the bad vibes it reaches: a member now after the one who
// taunted has been torn away.
function free(state: SimState, enemy: EnemyState, reach: number, boss: EnemyState): boolean {
  if (enemy.hp <= 0 || !touches(enemy, boss, reach * LOST_REACHES)) {
    return true;
  }
  return state.events.some((event) => event.type === 'taunted' && event.playerId === enemy.target);
}

// The ring turns every tick (`src/sim/rings.ts` walks its members to their places). Members dead,
// lost far away or torn away by a taunt leave it; on the one of every bar, the nearest bad vibes
// within reach fill the empty places.
export const moshRing: SpecialModule = ({ state }, boss, effect) => {
  if (effect.kind !== 'moshRing') {
    return;
  }
  boss.ring ??= { x: 1, y: 0 };
  turnRing(boss.ring);
  const taken = new Set<number>();
  for (const enemy of state.enemies) {
    if (enemy.ringOf?.id !== boss.id) {
      continue;
    }
    if (free(state, enemy, effect.reach, boss)) {
      delete enemy.ringOf;
    } else {
      taken.add(enemy.ringOf.slot);
    }
  }
  if (taken.size === RING_SIZE || !state.events.some((event) => event.type === 'bar')) {
    return;
  }
  const candidates = state.enemies
    .filter(
      (enemy) =>
        enemy !== boss &&
        !enemy.isBoss &&
        enemy.hp > 0 &&
        enemy.ringOf === undefined &&
        enemy.escaped !== true &&
        enemy.fleeing !== true &&
        enemy.clingingTo === undefined &&
        touches(enemy, boss, effect.reach),
    )
    .map((enemy) => {
      const dx = enemy.x - boss.x;
      const dy = enemy.y - boss.y;
      return { enemy, far: dx * dx + dy * dy };
    })
    .sort((a, b) => a.far - b.far || a.enemy.id - b.enemy.id);
  for (let slot = 0; slot < RING_SIZE && candidates.length > 0; slot += 1) {
    if (taken.has(slot)) {
      continue;
    }
    const next = candidates.shift();
    if (next !== undefined) {
      next.enemy.ringOf = { id: boss.id, slot, orbit: effect.orbit };
    }
  }
};
