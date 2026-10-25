import { clamp, clamp01 } from '../shared/scalar';
import { normalize } from '../shared/vec';
import { applyEnemyStatus } from './enemy-status';
import type { EnemyState, PlayerState, SimState, WallState } from './state';
import type { StepContext } from './systems/types';

export interface WallShape {
  distance: number;
  length: number;
  ticks: number;
}

export function raiseWall(state: SimState, player: PlayerState, shape: WallShape): WallState {
  const aim = normalize(player.aim);
  const normal = aim.x === 0 && aim.y === 0 ? { x: 1, y: 0 } : aim;
  const wall: WallState = {
    id: state.nextEntityId++,
    playerId: player.id,
    x: player.x + normal.x * shape.distance,
    y: player.y + normal.y * shape.distance,
    normal,
    halfLength: shape.length / 2,
    ticksLeft: shape.ticks,
  };
  (state.walls ??= []).push(wall);
  return wall;
}

// After every system that moves bad vibes; a boss is slowed for a beat instead of held.
export function walls({ state, tempo }: StepContext): void {
  const raised = state.walls;
  if (raised === undefined) {
    return;
  }
  for (const wall of raised) {
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }
      if (enemy.isBoss) {
        if (touchesWall(wall, enemy)) {
          applyEnemyStatus(state, enemy, 'slowed', tempo.ticksPerBeat);
        }
      } else {
        holdBack(wall, enemy);
      }
    }
    wall.ticksLeft -= 1;
  }
  const standing = raised.filter((wall) => wall.ticksLeft > 0);
  if (standing.length === 0) {
    delete state.walls;
  } else if (standing.length < raised.length) {
    state.walls = standing;
  }
}

function touchesWall(wall: WallState, enemy: EnemyState): boolean {
  const { normal, halfLength } = wall;
  const rx = enemy.x - wall.x;
  const ry = enemy.y - wall.y;
  const u = rx * -normal.y + ry * normal.x;
  const along = u - clamp(u, -halfLength, halfLength);
  const across = rx * normal.x + ry * normal.y;
  return along * along + across * across < enemy.radius * enemy.radius;
}

function holdBack(wall: WallState, enemy: EnemyState): void {
  const { normal, halfLength } = wall;
  const tx = -normal.y;
  const ty = normal.x;
  const rx = enemy.x - wall.x;
  const ry = enemy.y - wall.y;
  const u = rx * tx + ry * ty;
  const v = rx * normal.x + ry * normal.y;
  const px = enemy.prevX - wall.x;
  const py = enemy.prevY - wall.y;
  const pu = px * tx + py * ty;
  const pv = px * normal.x + py * normal.y;
  const side = pv < 0 ? -1 : 1;
  const reach = enemy.radius;
  const crossedAt = side * v < 0 ? pu + ((u - pu) * pv) / (pv - v) : u;
  if (side * v < reach && (Math.abs(u) <= halfLength || Math.abs(crossedAt) <= halfLength)) {
    place(wall, enemy, u, side * reach);
    return;
  }
  const end = crossedAt < 0 ? -halfLength : halfLength;
  // A step that crosses the line past an end is held if its path, not only where it lands, touches that end.
  const su = u - pu;
  const sv = v - pv;
  const length = su * su + sv * sv;
  const t = side * v < 0 && length > 0 ? clamp01(((end - pu) * su - pv * sv) / length) : 1;
  const du = pu + su * t - end;
  const dv = side * Math.abs(pv + sv * t);
  const squared = du * du + dv * dv;
  if (squared >= reach * reach) {
    return;
  }
  const distance = Math.sqrt(squared);
  if (distance === 0) {
    place(wall, enemy, end, side * reach);
  } else {
    place(wall, enemy, end + (du / distance) * reach, (dv / distance) * reach);
  }
}

function place(wall: WallState, enemy: EnemyState, u: number, v: number): void {
  const { normal } = wall;
  enemy.x = wall.x - u * normal.y + v * normal.x;
  enemy.y = wall.y + u * normal.x + v * normal.y;
}
