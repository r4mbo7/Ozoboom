import { lookup } from '../content';
import { drawRelics } from '../draw';
import { recruitFallen } from '../recruits';
import { SPECIALS } from '../specials';
import type { PickupKind, SimState } from '../state';
import { dropBomb } from './bomb';
import { dropLoot } from './loot';
import { isLastTier } from './set-progress';
import type { StepContext } from './types';

// Between the loots a boss drops side by side, one per player.
const LOOT_SPACING = 40;

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
    const base = enemy.isBoss ? set.tiers[state.set.tier]?.boss.vibesDrop : undefined;
    const vibesDrop = (base ?? definition.vibesDrop) + (enemy.carrying ?? 0);
    state.events.push({
      type: 'enemyDied',
      id: enemy.id,
      kind: enemy.kind,
      x: enemy.x,
      y: enemy.y,
      byPlayer: enemy.lastHitBy ?? null,
    });
    state.stats.kills += 1;
    recruitFallen(ctx, enemy, definition);
    if (enemy.isBoss && !isLastTier(state.set, set)) {
      offerRelics(ctx);
    }
    if (enemy.carriesLoot === true) {
      dropLoot(ctx, enemy.x, enemy.y);
    }
    if (enemy.carriesBomb === true) {
      dropBomb(ctx, enemy.x, enemy.y);
    }
    if (enemy.isBoss) {
      state.players.forEach((_, index) => {
        dropLoot(ctx, enemy.x + (index - (state.players.length - 1) / 2) * LOOT_SPACING, enemy.y);
      });
    }
    if (vibesDrop > 0) {
      drop(state, 'vibes', vibesDrop, enemy.x, enemy.y, set.pickups.lifetimeTicks);
    }
  }
  state.enemies.length = kept;
}

function offerRelics({ state, content }: StepContext): void {
  for (const player of state.players) {
    if (player.gone === true) {
      continue;
    }
    const options = drawRelics(state.rng, state, content, player);
    if (options.length > 0) {
      const rarities = options.map(() => 'common' as const);
      state.pendingUpgrades.push({ playerId: player.id, options, rarities, kind: 'relic' });
      state.events.push({ type: 'relicOffered', playerId: player.id, options });
    }
  }
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
