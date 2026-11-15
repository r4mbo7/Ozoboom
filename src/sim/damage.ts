import type { Circle } from './spatial-hash';
import type { EnemyState, PlayerId, PlayerState, SimState } from './state';

export function damagePlayer(state: SimState, player: PlayerState, amount: number): void {
  if (player.downed || (player.invulnerableTicks ?? 0) > 0) {
    return;
  }
  player.hp = Math.max(0, player.hp - amount);
  state.events.push({ type: 'playerHit', playerId: player.id, damage: amount });
  if (player.hp <= 0) {
    player.downed = true;
    state.events.push({ type: 'playerDowned', playerId: player.id });
  }
}

export function damageCore(state: SimState, amount: number): void {
  state.core.hp = Math.max(0, state.core.hp - amount);
  state.events.push({ type: 'coreHit', damage: amount });
}

export function playerById(state: SimState, id: PlayerId): PlayerState | undefined {
  for (const player of state.players) {
    if (player.id === id) {
      return player;
    }
  }
  return undefined;
}

// What a bad vibe goes for: the core once its player or dancer is gone.
export function targetOf(state: SimState, enemy: EnemyState): Circle {
  if (enemy.target === 'core') {
    return state.core;
  }
  if (enemy.target === 'dancer') {
    return state.dancer ?? state.core;
  }
  return playerById(state, enemy.target) ?? state.core;
}
