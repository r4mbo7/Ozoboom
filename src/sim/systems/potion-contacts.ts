import { add, normalize, scale, sub, type Vec2 } from '../../shared/vec';
import { knockBack } from '../effects';
import { potionShielded } from '../potion-shield';
import type { EnemyState, PlayerState } from '../state';
import { inContact } from './enemy-attacks';
import type { StepContext } from './types';

// Runs before the specials and the strikes, so the Collant and the strikes see the bounce first.
export function potionContacts({ state, set, tempo, enemyObstacles }: StepContext): void {
  const rules = set.potion;
  if (rules === undefined || !state.players.some(isShieldedStanding)) {
    return;
  }
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || bouncedThisBeat(enemy, state.tick, tempo.ticksPerBeat)) {
      continue;
    }
    const player = shieldedTouching(state.players, enemy);
    if (player === undefined) {
      continue;
    }
    const { x, y } = rimToward(player, enemy);
    knockBack(enemy, player, rules.bounce, enemyObstacles);
    enemy.potionBounceTick = state.tick;
    state.events.push({ type: 'potionBounced', playerId: player.id, enemyId: enemy.id, x, y });
  }
}

// A player whose peer left stays where they stood, but no longer plays: like a pickup, no bounce.
function isShieldedStanding(player: PlayerState): boolean {
  return !player.downed && player.gone !== true && potionShielded(player);
}

function shieldedTouching(
  players: readonly PlayerState[],
  enemy: EnemyState,
): PlayerState | undefined {
  for (const player of players) {
    if (isShieldedStanding(player) && inContact(enemy, player)) {
      return player;
    }
  }
  return undefined;
}

function bouncedThisBeat(enemy: EnemyState, tick: number, ticksPerBeat: number): boolean {
  return enemy.potionBounceTick !== undefined && tick - enemy.potionBounceTick < ticksPerBeat;
}

function rimToward(player: PlayerState, enemy: EnemyState): Vec2 {
  return add(player, scale(normalize(sub(enemy, player)), player.radius));
}
