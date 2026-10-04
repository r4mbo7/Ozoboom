import type { PlayerState, SimState } from '../state';

// The oldest of the player's placed weapons of this kind makes room when `limit` is reached.
export function place(
  state: SimState,
  player: PlayerState,
  weaponId: string,
  at: { x: number; y: number },
  radius: number,
  ticksLeft: number,
  limit: number,
): void {
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
    x: at.x,
    y: at.y,
    prevX: at.x,
    prevY: at.y,
    radius,
    ticksLeft,
    cooldown: 0,
  });
  state.events.push({ type: 'placedSpawned', id, weaponId, x: at.x, y: at.y });
}
