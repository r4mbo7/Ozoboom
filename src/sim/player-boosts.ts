import { lookup } from './content';
import type { BoostModifier, PlayerState } from './state';
import { applyDerivedStats } from './stats';
import type { StepContext } from './systems/types';

export interface BoostShape {
  // Two boosts of the same id never stack: the longer duration and the latest modifiers hold.
  id: string;
  modifiers: readonly BoostModifier[];
  ticks: number;
}

export function applyPlayerBoost(
  { state, content }: Pick<StepContext, 'state' | 'content'>,
  player: PlayerState,
  { id, modifiers, ticks }: BoostShape,
): void {
  if (ticks <= 0) {
    return;
  }
  const boosts = (player.boosts ??= []);
  const running = boosts.find((boost) => boost.id === id);
  if (running === undefined) {
    boosts.push({ id, modifiers, ticksLeft: ticks });
    state.events.push({ type: 'playerBoostStarted', playerId: player.id, boost: id });
  } else {
    running.modifiers = modifiers;
    running.ticksLeft = Math.max(running.ticksLeft, ticks);
  }
  applyDerivedStats(player, lookup(content.classes, player.classId, 'class'));
}

// After the last system that reads a stat: a boost posed for n ticks rules n steps.
export function playerBoosts({ state, content }: StepContext): void {
  for (const player of state.players) {
    const boosts = player.boosts;
    if (boosts === undefined) {
      continue;
    }
    for (const boost of boosts) {
      boost.ticksLeft -= 1;
      if (boost.ticksLeft === 0) {
        state.events.push({ type: 'playerBoostEnded', playerId: player.id, boost: boost.id });
      }
    }
    const running = boosts.filter((boost) => boost.ticksLeft > 0);
    if (running.length === boosts.length) {
      continue;
    }
    if (running.length === 0) {
      delete player.boosts;
    } else {
      player.boosts = running;
    }
    applyDerivedStats(player, lookup(content.classes, player.classId, 'class'));
  }
}
