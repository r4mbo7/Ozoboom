import { damageCore, damagePlayer, playerById } from '../damage';
import { healPlayer, hurtEnemy, markedDamageMul, pushAway } from '../effects';
import type { PlayerId, PlayerState, ProjectileState, SimState } from '../state';
import type { StepContext } from './types';

const LANDING_KNOCKBACK_PER_RADIUS = 0.25;
const RETURN_TICKS = 600;

export function projectiles({ state, content, enemyGrid }: StepContext): void {
  const markedMul = markedDamageMul(content);
  enemyGrid.rebuild(state.enemies);
  const { width, height } = state.arena;
  let kept = 0;
  for (const projectile of state.projectiles) {
    if (projectile.returning === true && flyHome(state, projectile)) {
      continue;
    }
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;
    projectile.ticksLeft -= 1;
    let spent = false;
    if (projectile.owner.kind === 'enemy') {
      spent = hitPlayerOrCore(state, projectile);
    } else if (projectile.returning !== true && projectile.arc === undefined) {
      spent = hitEnemies(state, enemyGrid, projectile, markedMul);
    }
    const inArena =
      projectile.x >= 0 && projectile.x <= width && projectile.y >= 0 && projectile.y <= height;
    if (!spent && (projectile.ticksLeft <= 0 || !inArena)) {
      spent = !endOfFlight(state, enemyGrid, projectile, markedMul);
    }
    if (!spent) {
      state.projectiles[kept] = projectile;
      kept += 1;
    }
  }
  state.projectiles.length = kept;
}

// A lobbed projectile lands, a frisbee turns back; anything else is done. Returns whether the
// projectile flies on.
function endOfFlight(
  state: SimState,
  grid: StepContext['enemyGrid'],
  projectile: ProjectileState,
  markedMul: number,
): boolean {
  if (projectile.arc !== undefined) {
    land(state, grid, projectile, markedMul);
    return false;
  }
  if (projectile.returnTo === undefined || projectile.returning === true) {
    return false;
  }
  const ally = mostInjured(state);
  if (ally === undefined) {
    return false;
  }
  projectile.returnTo = ally.id;
  projectile.returning = true;
  projectile.ticksLeft = RETURN_TICKS;
  projectile.x = Math.min(state.arena.width, Math.max(0, projectile.x));
  projectile.y = Math.min(state.arena.height, Math.max(0, projectile.y));
  return true;
}

function land(
  state: SimState,
  grid: StepContext['enemyGrid'],
  projectile: ProjectileState,
  markedMul: number,
): void {
  const byPlayer = creditedPlayer(state, projectile);
  const found = grid.query(projectile.x, projectile.y, projectile.radius);
  for (let i = 0; i < found; i++) {
    const enemy = state.enemies[grid.result(i)];
    if (enemy === undefined || enemy.hp <= 0) {
      continue;
    }
    hurtEnemy(state, enemy, projectile.damage, markedMul, byPlayer);
    pushAway(enemy, projectile, projectile.radius * LANDING_KNOCKBACK_PER_RADIUS);
  }
}

function mostInjured(state: SimState): PlayerState | undefined {
  let worst: PlayerState | undefined;
  for (const player of state.players) {
    if (
      !player.downed &&
      (worst === undefined || player.hp / player.maxHp < worst.hp / worst.maxHp)
    ) {
      worst = player;
    }
  }
  return worst;
}

// Aims the frisbee at its ally at constant speed. Returns whether it is spent: it reached the
// ally and healed them, or there is no one left to reach.
function flyHome(state: SimState, projectile: ProjectileState): boolean {
  const ally =
    projectile.returnTo === undefined ? undefined : playerById(state, projectile.returnTo);
  if (ally === undefined || ally.downed) {
    return true;
  }
  const dx = ally.x - projectile.x;
  const dy = ally.y - projectile.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const speed = Math.sqrt(projectile.vx * projectile.vx + projectile.vy * projectile.vy);
  if (distance <= speed + ally.radius) {
    healPlayer(state, ally, projectile.heal ?? 0);
    return true;
  }
  projectile.vx = (dx / distance) * speed;
  projectile.vy = (dy / distance) * speed;
  return false;
}

// Returns whether the projectile is spent.
function hitEnemies(
  state: SimState,
  grid: StepContext['enemyGrid'],
  projectile: ProjectileState,
  markedMul: number,
): boolean {
  const byPlayer = creditedPlayer(state, projectile);
  const found = grid.query(projectile.x, projectile.y, projectile.radius);
  for (let i = 0; i < found; i++) {
    const enemy = state.enemies[grid.result(i)];
    if (enemy === undefined || enemy.hp <= 0 || projectile.hitIds?.includes(enemy.id) === true) {
      continue;
    }
    hurtEnemy(state, enemy, projectile.damage, markedMul, byPlayer);
    if (projectile.knockback !== undefined) {
      pushAway(enemy, projectile, projectile.knockback);
    }
    if (projectile.pierceLeft <= 0) {
      return true;
    }
    projectile.pierceLeft -= 1;
    (projectile.hitIds ??= []).push(enemy.id);
  }
  return false;
}

function creditedPlayer(state: SimState, projectile: ProjectileState): PlayerId | null {
  const { owner } = projectile;
  switch (owner.kind) {
    case 'player':
    case 'weapon':
      return owner.playerId;
    case 'trap':
      return state.traps.find((trap) => trap.id === owner.trapId)?.ownerId ?? null;
    case 'enemy':
      return null;
  }
}

function hitPlayerOrCore(state: SimState, projectile: ProjectileState): boolean {
  for (const player of state.players) {
    if (!player.downed && touches(projectile, player)) {
      damagePlayer(state, player, projectile.damage);
      return true;
    }
  }
  if (touches(projectile, state.core)) {
    damageCore(state, projectile.damage);
    return true;
  }
  return false;
}

function touches(
  projectile: ProjectileState,
  circle: { x: number; y: number; radius: number },
): boolean {
  const dx = projectile.x - circle.x;
  const dy = projectile.y - circle.y;
  const reach = projectile.radius + circle.radius;
  return dx * dx + dy * dy <= reach * reach;
}
