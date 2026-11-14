import { barOfTick, isBarTick } from '../../shared/tempo';
import type { EnemyState, PlayerId, Vec2 } from '../state';
import { statValue } from '../stats';
import { dropTrap } from '../trap-moves';
import { drawCarriersTrap } from '../trap-odds';
import type { StepContext } from './types';

export function trapCarriers(ctx: StepContext): void {
  const { state, set, tempo } = ctx;
  const rules = set.carriers;
  if (rules === undefined) {
    return;
  }
  const bar = barOfTick(state.tick, tempo);
  // Each Volume level and each Talkie-walkie brings them more often.
  const bars = state.players.reduce(
    (every, player) => statValue(player, 'carrierIntervalMul', every),
    rules.everyBars / (1 + rules.frequencyPerVolume * (state.volume ?? 0)),
  );
  const interval = Math.max(1, Math.ceil(bars));
  if (isBarTick(state.tick, tempo) && bar >= (state.nextCarrierBar ?? interval)) {
    state.carrierDue = true;
    state.nextCarrierBar = bar + interval;
  }
  if (state.carrierDue !== true) {
    return;
  }
  for (const event of state.events) {
    const enemy =
      event.type === 'enemySpawned' ? state.enemies.find(({ id }) => id === event.id) : undefined;
    if (enemy !== undefined && !enemy.isBoss) {
      enemy.carriesTrap = drawCarriedTrap(ctx);
      state.carrierDue = false;
      return;
    }
  }
}

// Killed by no one, it drops its trap in the first player's name.
export function dropCarriedTrap(ctx: StepContext, enemy: EnemyState): void {
  const owner = enemy.lastHitBy ?? ctx.state.players[0]?.id;
  if (enemy.carriesTrap !== undefined && owner !== undefined) {
    dropTrap(ctx, enemy.carriesTrap, owner, enemy);
  }
}

// One of a boss's traps, in that player's name.
export function dropBossTrap(ctx: StepContext, playerId: PlayerId, at: Vec2): void {
  if (ctx.set.carriers !== undefined) {
    dropTrap(ctx, drawCarriedTrap(ctx), playerId, at);
  }
}

function drawCarriedTrap({ state, content, set }: StepContext): string {
  const drawn = state.trapsDrawn ?? 0;
  state.trapsDrawn = drawn + 1;
  const draw = state.trapDraw;
  if (drawn === 0) {
    const first = draw?.first ?? set.carriers?.first;
    if (first !== undefined) {
      return first;
    }
  }
  return drawCarriersTrap(state.rng, content.traps, draw);
}
