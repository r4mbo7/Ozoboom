import type { GameContent, TrapDefinition } from '../data/types';
import type { SimState } from '../sim/state';
import { FULL_PLACE_KEY } from './full';
import { trapCapacity, trapToTake } from './hud-model';
import type { Prompts } from './prompts';
import type { LocalPlayer, StepGuide } from './types';

type KeyTraps = StepGuide['keyTraps'];

// The trap each player's place key would take, as the HUD names it, and the tick it started to: none
// where the key has another use, at a board. Called on every step, so that a player who leaves and
// comes back between two frames counts again. The key is the one of the player's own device, '' for a player on another screen
// and on touch. `previous` comes back while nothing changes.
export function keyTraps(
  state: SimState,
  content: Pick<GameContent, 'classes'>,
  definitions: ReadonlyMap<string, Pick<TrapDefinition, 'radius'>>,
  players: readonly LocalPlayer[],
  prompts: Prompts,
  previous: KeyTraps,
): KeyTraps {
  const traps: KeyTraps[number][] = [];
  for (const player of state.players) {
    if (FULL_PLACE_KEY.use?.(state, player) !== undefined) {
      continue;
    }
    const trap = trapToTake(definitions, state, player, trapCapacity(content, player));
    if (trap === undefined) {
      continue;
    }
    const device = players.find((local) => local.playerId === player.id)?.snapshot.device;
    const key = device === undefined ? '' : prompts.for(device).placeTrap;
    const was = previous.find((keyTrap) => keyTrap.playerId === player.id);
    const since = was?.trapId === trap.id ? was.since : state.tick;
    traps.push({ playerId: player.id, trapId: trap.id, since, key });
  }
  const same =
    traps.length === previous.length &&
    traps.every((trap, index) => {
      const was = previous[index];
      return (
        was?.playerId === trap.playerId &&
        was.trapId === trap.trapId &&
        was.since === trap.since &&
        was.key === trap.key
      );
    });
  return same ? previous : traps;
}
