import type { Emote } from '../commands';
import type { StepContext } from './types';

// A gesture is only seen: the sim tells who makes which, and keeps nothing of it.
export function emotes(ctx: StepContext): void {
  const { state, commands } = ctx;
  for (const player of state.players) {
    if (player.downed) {
      continue;
    }
    let emote: Emote | undefined;
    for (const action of commands.get(player.id)?.actions ?? []) {
      if (action.type === 'emote') {
        emote = action.emote;
      }
    }
    if (emote !== undefined) {
      state.events.push({ type: 'emoted', playerId: player.id, emote });
    }
  }
}
