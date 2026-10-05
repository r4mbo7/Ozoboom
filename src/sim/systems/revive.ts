import { TICKS_PER_BAR, TICKS_PER_BEAT } from '../../shared/tempo';
import { lookup, type ResolvedContent } from '../content';
import { touches } from '../effects';
import type { PlayerState, SimState } from '../state';
import type { StepContext } from './types';

const REVIVED_INVULNERABLE_TICKS = 4 * TICKS_PER_BEAT;

export function revive({ state, content, set }: StepContext): void {
  const needed = (set.reviveBars ?? 1) * TICKS_PER_BAR;
  for (const player of state.players) {
    if (!player.downed) {
      continue;
    }
    const helper = bestHelper(state, content, player);
    if (helper === undefined) {
      if (player.reviveTicks !== undefined) {
        player.reviveTicks = 0;
      }
      continue;
    }
    const reviveTicks = (player.reviveTicks ?? 0) + helper.mul;
    if (reviveTicks >= needed) {
      player.downed = false;
      player.hp = player.maxHp / 2;
      player.invulnerableTicks = REVIVED_INVULNERABLE_TICKS;
      player.reviveTicks = 0;
      state.events.push({ type: 'playerRevived', playerId: player.id });
      continue;
    }
    player.reviveTicks = reviveTicks;
    state.events.push({
      type: 'playerReviving',
      playerId: player.id,
      byPlayer: helper.player.id,
      progress: reviveTicks / needed,
    });
  }
}

export function reviveMulOf(content: ResolvedContent, player: PlayerState): number {
  return lookup(content.classes, player.classId, 'class').reviveMul ?? 1;
}

// The standing ally in contact with the highest reviveMul; the first one wins a tie.
function bestHelper(
  state: SimState,
  content: ResolvedContent,
  downed: PlayerState,
): { player: PlayerState; mul: number } | undefined {
  let best: { player: PlayerState; mul: number } | undefined;
  for (const ally of state.players) {
    if (ally.downed || !touches(downed, ally, ally.radius)) {
      continue;
    }
    const mul = reviveMulOf(content, ally);
    if (best === undefined || mul > best.mul) {
      best = { player: ally, mul };
    }
  }
  return best;
}
