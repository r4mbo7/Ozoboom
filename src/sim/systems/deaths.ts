import { lookup } from '../content';
import { SPECIALS } from '../specials';
import type { PickupKind, SimState } from '../state';
import type { StepContext } from './types';

export function deaths(ctx: StepContext): void {
  const { state, content, set } = ctx;
  let kept = 0;
  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      state.enemies[kept] = enemy;
      kept += 1;
      continue;
    }
    if (enemy.escaped === true) {
      state.events.push({
        type: 'enemyFled',
        id: enemy.id,
        kind: enemy.kind,
        x: enemy.x,
        y: enemy.y,
      });
      continue;
    }
    const definition = lookup(content.enemies, enemy.kind, 'enemy');
    if (definition.special?.kind === 'revive') {
      SPECIALS.revive(ctx, enemy, definition.special);
      if (enemy.hp > 0 || enemy.downTicks !== undefined) {
        state.enemies[kept] = enemy;
        kept += 1;
        continue;
      }
    }
    const vibesDrop = definition.vibesDrop + (enemy.carrying ?? 0);
    const { wattsDrop } = definition;
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
    const { lifetimeTicks } = set.pickups;
    if (vibesDrop > 0) {
      drop(state, 'vibes', vibesDrop, enemy.x - spread, enemy.y, lifetimeTicks);
    }
    if (wattsDrop > 0) {
      drop(state, 'watts', wattsDrop, enemy.x + spread, enemy.y, lifetimeTicks);
    }
  }
  state.enemies.length = kept;
}

function drop(
  state: SimState,
  kind: PickupKind,
  amount: number,
  x: number,
  y: number,
  ticksLeft: number,
): void {
  state.pickups.push({
    id: state.nextEntityId,
    kind,
    amount,
    x,
    y,
    prevX: x,
    prevY: y,
    ticksLeft,
  });
  state.nextEntityId += 1;
}
