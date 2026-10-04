import { TICKS_PER_BAR } from '../../shared/tempo';
import { touches } from '../effects';
import { playerById } from '../damage';
import type { EnemyState, PlayerState, SimState } from '../state';
import type { SpecialModule, SteeringTarget } from './types';

export const cling: SpecialModule = (ctx, enemy, effect) => {
  if (effect.kind !== 'cling') {
    return;
  }
  const { state } = ctx;
  if (enemy.clingCooldown !== undefined && enemy.clingCooldown > 0) {
    enemy.clingCooldown -= 1;
  }
  if (enemy.clingingTo !== undefined) {
    const hit = (enemy.hpWatermark ?? enemy.hp) - enemy.hp;
    const player = playerById(state, enemy.clingingTo);
    if (hit >= effect.detachDamage || player === undefined || player.downed) {
      detach(enemy);
    } else {
      slow(player, effect.slowFactor);
    }
  } else if ((enemy.clingCooldown ?? 0) === 0 && typeof enemy.target === 'number') {
    attachIfFree(state, enemy, enemy.target, effect.slowFactor);
  }
  enemy.hpWatermark = enemy.hp;
};

export const clingSteering: SteeringTarget = (ctx, enemy, effect) => {
  if (effect.kind !== 'cling' || enemy.clingingTo === undefined) {
    return undefined;
  }
  const player = playerById(ctx.state, enemy.clingingTo);
  return player === undefined ? undefined : { target: player };
};

function attachIfFree(
  state: SimState,
  enemy: EnemyState,
  playerId: PlayerState['id'],
  slowFactor: number,
): void {
  const player = playerById(state, playerId);
  if (
    player === undefined ||
    player.downed ||
    !touches(enemy, player, player.radius) ||
    state.enemies.some((other) => other !== enemy && other.clingingTo === playerId)
  ) {
    return;
  }
  enemy.clingingTo = playerId;
  slow(player, slowFactor);
}

function slow(player: PlayerState, slowFactor: number): void {
  player.slowFactor = Math.min(player.slowFactor ?? 1, slowFactor);
}

function detach(enemy: EnemyState): void {
  delete enemy.clingingTo;
  enemy.clingCooldown = TICKS_PER_BAR;
}
