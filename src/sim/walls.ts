import { isBeatTick, ticksIntoBeat } from '../shared/tempo';
import { playerById } from './damage';
import { hurtEnemy, pushAway } from './effects';
import { applyEnemyStatus } from './enemy-status';
import { moveUntilBlocked, type Obstacles } from './obstacles';
import type { EnemyState, PlayerState, ProjectileState, SimState, WallState } from './state';
import type { StepContext } from './systems/types';

const EDGE_ROUNDING = 1e-6;

export interface WallShape {
  x: number;
  y: number;
  reach: number;
  growTicks: number;
  ticks: number;
  damage?: number;
  bossPush?: number;
}

// Growing from nothing at (x, y); its player stands still until it falls.
export function raiseWall(state: SimState, player: PlayerState, shape: WallShape): WallState {
  const wall: WallState = {
    id: state.nextEntityId++,
    playerId: player.id,
    x: shape.x,
    y: shape.y,
    radius: 0,
    reach: shape.reach,
    grow: shape.reach / Math.max(1, shape.growTicks),
    ticksLeft: shape.ticks,
    ...(shape.damage === undefined ? {} : { damage: shape.damage }),
    ...(shape.bossPush === undefined ? {} : { bossPush: shape.bossPush }),
  };
  (state.walls ??= []).push(wall);
  return wall;
}

// When the game leaves the stage they stand on: a player is protected for as long as their circle
// stands, and the timer that says so would outlive it.
export function takeDownWalls(state: SimState): void {
  for (const wall of state.walls ?? []) {
    const player = playerById(state, wall.playerId);
    if (player !== undefined) {
      player.invulnerableTicks = 0;
    }
  }
  delete state.walls;
}

export function holdsItsPlayer(state: SimState, player: Pick<PlayerState, 'id'>): boolean {
  return state.walls?.some((wall) => wall.playerId === player.id) ?? false;
}

// A shot of a bad vibe ends where it touches a circle, before it can hit what stands behind.
export function stopsShot(state: SimState, shot: ProjectileState): boolean {
  for (const wall of state.walls ?? []) {
    const dx = shot.x - wall.x;
    const dy = shot.y - wall.y;
    const reach = wall.radius + shot.radius;
    if (dx * dx + dy * dy <= reach * reach) {
      state.events.push({ type: 'shotStopped', playerId: wall.playerId, x: shot.x, y: shot.y });
      return true;
    }
  }
  return false;
}

// After every system that moves bad vibes; a boss is slowed for a beat instead of held out, at most pushed.
export function walls({ state, tempo, enemyObstacles }: StepContext): void {
  const raised = state.walls;
  if (raised === undefined) {
    return;
  }
  const beat = isBeatTick(state.tick, tempo);
  const shoveTicks = Math.floor(tempo.ticksPerBeat / 2);
  for (const wall of raised) {
    wall.radius = Math.min(wall.reach, wall.radius + wall.grow);
    const burns = beat && wall.damage !== undefined;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) {
        continue;
      }
      let pressing: boolean;
      if (enemy.isBoss) {
        pressing = touchesWall(wall, enemy);
        if (pressing) {
          applyEnemyStatus(state, enemy, 'slowed', tempo.ticksPerBeat);
          if (wall.bossPush !== undefined && shoveTicks > ticksIntoBeat(state.tick, tempo)) {
            pushAway(enemy, wall, wall.bossPush / shoveTicks, enemyObstacles);
          }
        }
      } else {
        pressing = holdOut(wall, enemy, enemyObstacles);
      }
      if (burns && pressing) {
        hurtEnemy(state, enemy, wall.damage ?? 0, wall.playerId, wall);
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
  const dx = enemy.x - wall.x;
  const dy = enemy.y - wall.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.abs(distance - wall.radius) < enemy.radius;
}

// True when the bad vibe touches it, held out just now or resting where it was: a push leaves it on
// the edge, either side by a rounding, or against the obstacle of the stage in its way.
function holdOut(wall: WallState, enemy: EnemyState, obstacles: Obstacles): boolean {
  const reach = wall.radius + enemy.radius;
  const dx = enemy.x - wall.x;
  const dy = enemy.y - wall.y;
  const squared = dx * dx + dy * dy;
  if (squared >= reach * reach) {
    const touching = reach + EDGE_ROUNDING;
    return squared <= touching * touching;
  }
  const distance = Math.sqrt(squared);
  let ux: number;
  let uy: number;
  if (distance > 0) {
    ux = dx / distance;
    uy = dy / distance;
  } else {
    const px = enemy.prevX - wall.x;
    const py = enemy.prevY - wall.y;
    const before = Math.sqrt(px * px + py * py);
    ux = before > 0 ? px / before : 1;
    uy = before > 0 ? py / before : 0;
  }
  moveUntilBlocked(enemy, wall.x + ux * reach - enemy.x, wall.y + uy * reach - enemy.y, obstacles);
  return true;
}
