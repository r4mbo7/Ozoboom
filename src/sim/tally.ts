import type { PlayerState, PlayerTally } from './state';

export function tallyOf(player: PlayerState): PlayerTally {
  player.tally ??= { badVibes: 0, bosses: 0, revives: 0, vibes: 0 };
  return player.tally;
}
