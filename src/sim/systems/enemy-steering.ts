import type { EnemyDefinition } from '../../data/types';
import { distanceSquared } from '../../shared/vec';
import { lookup, type ResolvedContent } from '../content';
import { playerById } from '../damage';
import type { Circle } from '../spatial-hash';
import type { EnemyState, SimState } from '../state';
import type { StepContext } from './types';

// A chased player who gets farther than this many aggro radii is dropped for the core.
const LEASH_IN_AGGRO_RADII = 2;
// Share of its speed a horde enemy spends moving away from the ones it overlaps.
const SEPARATION_WEIGHT = 0.5;
const separation = { x: 0, y: 0 };

export function enemySteering({ state, content, enemyGrid }: StepContext): void {
  enemyGrid.rebuild(state.enemies);
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) {
      continue;
    }
    const definition = lookup(content.enemies, enemy.kind, 'enemy');
    chooseTarget(state, enemy, definition);
    if (enemy.stunTicks > 0) {
      continue;
    }
    const target = targetOf(state, enemy);
    const speed = enemy.speed * enemy.slowFactor;
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const gap = distance - enemy.radius - target.radius;
    const advance =
      definition.ranged === undefined
        ? Math.min(speed, Math.max(0, gap))
        : Math.min(speed, Math.max(-speed, gap - definition.ranged.keepDistance));
    let moveX = distance === 0 ? 0 : (dx / distance) * advance;
    let moveY = distance === 0 ? 0 : (dy / distance) * advance;
    if (definition.behaviour === 'horde') {
      separate(state, enemyGrid, enemy);
      moveX += separation.x * speed * SEPARATION_WEIGHT;
      moveY += separation.y * speed * SEPARATION_WEIGHT;
    }
    enemy.x = clamp(enemy.x + moveX, enemy.radius, state.arena.width - enemy.radius);
    enemy.y = clamp(enemy.y + moveY, enemy.radius, state.arena.height - enemy.radius);
    const moved = moveX !== 0 || moveY !== 0;
    if (moved && (definition.behaviour === 'heavy' || definition.behaviour === 'boss')) {
      pushTraps(state, content, enemy);
    }
  }
}

export function targetOf(state: SimState, enemy: EnemyState): Circle {
  if (enemy.target === 'core') {
    return state.core;
  }
  return playerById(state, enemy.target) ?? state.core;
}

function chooseTarget(state: SimState, enemy: EnemyState, definition: EnemyDefinition): void {
  if (enemy.target !== 'core') {
    const chased = playerById(state, enemy.target);
    const leash = definition.aggroRadius * LEASH_IN_AGGRO_RADII;
    if (chased === undefined || chased.downed || distanceSquared(enemy, chased) > leash * leash) {
      enemy.target = 'core';
    }
  }
  if (enemy.target !== 'core') {
    return;
  }
  let nearest = definition.aggroRadius * definition.aggroRadius;
  for (const player of state.players) {
    const squared = distanceSquared(enemy, player);
    if (!player.downed && squared <= nearest) {
      nearest = squared;
      enemy.target = player.id;
    }
  }
}

// Writes in `separation` the direction away from the enemies this one overlaps, at most 1 long.
function separate(state: SimState, grid: StepContext['enemyGrid'], enemy: EnemyState): void {
  let x = 0;
  let y = 0;
  const found = grid.query(enemy.x, enemy.y, enemy.radius);
  for (let i = 0; i < found; i++) {
    const other = state.enemies[grid.result(i)];
    if (other === undefined || other === enemy) {
      continue;
    }
    const dx = enemy.x - other.x;
    const dy = enemy.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const touch = enemy.radius + other.radius;
    if (distance === 0 || distance >= touch) {
      continue;
    }
    const overlap = (touch - distance) / touch;
    x += (dx / distance) * overlap;
    y += (dy / distance) * overlap;
  }
  const length = Math.sqrt(x * x + y * y);
  const scale = length > 1 ? 1 / length : 1;
  separation.x = x * scale;
  separation.y = y * scale;
}

function pushTraps(state: SimState, content: ResolvedContent, enemy: EnemyState): void {
  for (const trap of state.traps) {
    const radius = lookup(content.traps, trap.kind, 'trap').radius;
    const dx = trap.x - enemy.x;
    const dy = trap.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const overlap = enemy.radius + radius - distance;
    if (overlap <= 0) {
      continue;
    }
    const awayX = distance === 0 ? 1 : dx / distance;
    const awayY = distance === 0 ? 0 : dy / distance;
    trap.x = clamp(trap.x + awayX * overlap, radius, state.arena.width - radius);
    trap.y = clamp(trap.y + awayY * overlap, radius, state.arena.height - radius);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
