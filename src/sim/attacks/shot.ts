import type { PlayerState, SimState, Vec2 } from '../state';

export interface Shot {
  speed: number;
  radius: number;
  damage: number;
  ticks: number;
  pierce: number;
  knockback?: number;
}

export function fireShot(state: SimState, player: PlayerState, direction: Vec2, shot: Shot): void {
  state.projectiles.push({
    id: state.nextEntityId,
    owner: { kind: 'player', playerId: player.id },
    x: player.x,
    y: player.y,
    prevX: player.x,
    prevY: player.y,
    vx: direction.x * shot.speed,
    vy: direction.y * shot.speed,
    radius: shot.radius,
    damage: shot.damage,
    ticksLeft: shot.ticks,
    pierceLeft: shot.pierce,
    ...(shot.knockback === undefined ? {} : { knockback: shot.knockback }),
  });
  state.nextEntityId += 1;
}
