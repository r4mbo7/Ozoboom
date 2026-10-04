import { damageCore, damagePlayer, playerById } from '../damage';
import { hurtEnemy, markedDamageMul } from '../effects';
import type { ProjectileState, SimState } from '../state';
import type { StepContext } from './types';

export function projectiles({ state, content, enemyGrid }: StepContext): void {
  const markedMul = markedDamageMul(content);
  enemyGrid.rebuild(state.enemies);
  const { width, height } = state.arena;
  let kept = 0;
  for (const projectile of state.projectiles) {
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;
    projectile.ticksLeft -= 1;
    const spent =
      projectile.owner.kind === 'enemy'
        ? hitPlayerOrCore(state, projectile)
        : hitEnemies(state, enemyGrid, projectile, markedMul);
    const inArena =
      projectile.x >= 0 && projectile.x <= width && projectile.y >= 0 && projectile.y <= height;
    if (!spent && projectile.ticksLeft > 0 && inArena) {
      state.projectiles[kept] = projectile;
      kept += 1;
    }
  }
  state.projectiles.length = kept;
}

// Returns whether the projectile is spent.
function hitEnemies(
  state: SimState,
  grid: StepContext['enemyGrid'],
  projectile: ProjectileState,
  markedMul: number,
): boolean {
  const byPlayer = projectile.owner.kind === 'player' ? projectile.owner.playerId : null;
  const found = grid.query(projectile.x, projectile.y, projectile.radius);
  for (let i = 0; i < found; i++) {
    const enemy = state.enemies[grid.result(i)];
    if (enemy === undefined || enemy.hp <= 0 || projectile.hitIds?.includes(enemy.id) === true) {
      continue;
    }
    hurtEnemy(state, enemy, projectile.damage, markedMul);
    if (byPlayer !== null) {
      enemy.lastHitBy = byPlayer;
      if (playerById(state, byPlayer)?.downed === false) {
        enemy.target = byPlayer;
      }
    }
    if (projectile.pierceLeft <= 0) {
      return true;
    }
    projectile.pierceLeft -= 1;
    (projectile.hitIds ??= []).push(enemy.id);
  }
  return false;
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
