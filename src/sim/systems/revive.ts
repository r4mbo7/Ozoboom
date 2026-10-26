import { lookup, type ResolvedContent } from '../content';
import { touches } from '../effects';
import type { PlayerState, SimState } from '../state';
import { tallyOf } from '../tally';
import type { StepContext } from './types';

export function revive({ state, content, set, tempo }: StepContext): void {
  const needed = (set.reviveBars ?? 1) * tempo.ticksPerBar;
  const invulnerableTicks = 4 * tempo.ticksPerBeat;
  for (const player of state.players) {
    if (!player.downed) {
      if ((player.reviveTicks ?? 0) > 0) {
        player.reviveTicks = 0;
      }
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
      player.invulnerableTicks = invulnerableTicks;
      player.reviveTicks = 0;
      tallyOf(helper.player).revives += 1;
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
