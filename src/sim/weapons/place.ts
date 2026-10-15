import { clearOfObstacles } from '../obstacles';
import type { PlayerState, SimState } from '../state';
import type { ObstacleDefinition } from '../../data/types';

// The oldest of the player's placed weapons of this kind makes room when `limit` is reached.
export function place(
  state: SimState,
  player: PlayerState,
  weaponId: string,
  at: { x: number; y: number },
  radius: number,
  ticksLeft: number,
  limit: number,
  obstacles: readonly ObstacleDefinition[] = [],
): void {
  const spot = clearOfObstacles(at, 0, obstacles);
  const placed = (state.placed ??= []);
  let mine = 0;
  for (const other of placed) {
    if (other.playerId === player.id && other.weaponId === weaponId) {
      mine += 1;
    }
  }
  for (let i = 0; mine >= limit && i < placed.length;) {
    const oldest = placed[i];
    if (oldest?.playerId === player.id && oldest.weaponId === weaponId) {
      placed.splice(i, 1);
      mine -= 1;
      state.events.push({
        type: 'placedRemoved',
        id: oldest.id,
        weaponId,
        x: oldest.x,
        y: oldest.y,
      });
    } else {
      i += 1;
    }
  }
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  placed.push({
    id,
    weaponId,
    playerId: player.id,
    x: spot.x,
    y: spot.y,
    prevX: spot.x,
    prevY: spot.y,
    radius,
    ticksLeft,
    cooldown: 0,
  });
  state.events.push({ type: 'placedSpawned', id, weaponId, x: spot.x, y: spot.y });
}
