import { TICKS_PER_BAR } from '../../shared/tempo';
import { lookup } from '../content';
import type { PickupKind, SimState } from '../state';
import type { StepContext } from './types';

export const PICKUP_LIFETIME_TICKS = 8 * TICKS_PER_BAR;

export function deaths({ state, content }: StepContext): void {
  let kept = 0;
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      state.enemies[kept] = enemy;
      kept += 1;
      continue;
    }
    const { vibesDrop, wattsDrop } = lookup(content.enemies, enemy.kind, 'enemy');
    state.events.push({
      type: 'enemyDied',
      id: enemy.id,
      kind: enemy.kind,
      x: enemy.x,
      y: enemy.y,
      byPlayer: enemy.lastHitBy ?? null,
    });
    state.stats.kills += 1;
    const spread = vibesDrop > 0 && wattsDrop > 0 ? enemy.radius / 2 : 0;
    if (vibesDrop > 0) {
      drop(state, 'vibes', vibesDrop, enemy.x - spread, enemy.y);
    }
    if (wattsDrop > 0) {
      drop(state, 'watts', wattsDrop, enemy.x + spread, enemy.y);
    }
  }
  state.enemies.length = kept;
}

function drop(state: SimState, kind: PickupKind, amount: number, x: number, y: number): void {
  state.pickups.push({
    id: state.nextEntityId,
    kind,
    amount,
    x,
    y,
    prevX: x,
    prevY: y,
    ticksLeft: PICKUP_LIFETIME_TICKS,
  });
  state.nextEntityId += 1;
}
