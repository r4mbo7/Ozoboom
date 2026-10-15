import type { PlayerState, ProjectileState, SimState, Vec2, WeaponSlot } from '../state';

type ShotSpec = Pick<
  ProjectileState,
  'radius' | 'damage' | 'ticksLeft' | 'pierceLeft' | 'arc' | 'returnTo' | 'heal'
>;

// A unit vector from `from` towards `to`; the player's aim when they coincide.
export function directionTo(from: Vec2, to: Vec2, fallback: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  return length === 0 ? fallback : { x: dx / length, y: dy / length };
}

export function shoot(
  state: SimState,
  player: PlayerState,
  slot: WeaponSlot,
  velocity: Vec2,
  spec: ShotSpec,
): void {
  state.projectiles.push({
    id: state.nextEntityId,
    owner: { kind: 'weapon', playerId: player.id, weaponId: slot.id },
    x: player.x,
    y: player.y,
    prevX: player.x,
    prevY: player.y,
    vx: velocity.x,
    vy: velocity.y,
    ...spec,
  });
  state.nextEntityId += 1;
}
