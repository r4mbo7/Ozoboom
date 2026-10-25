import type { EnemyDefinition } from '../../data/types';
import { clamp } from '../../shared/scalar';
import { distanceSquared } from '../../shared/vec';
import { lookup, type ResolvedContent } from '../content';
import { playerById } from '../damage';
import {
  bubbleDrift,
  disorientedHeading,
  hasStatus,
  isRooted,
  walkingSpeed,
} from '../enemy-status';
import { flowWaypoint } from '../flow-field';
import { lineBlocked, resolveObstacles } from '../obstacles';
import { ringTarget } from '../rings';
import type { Circle } from '../spatial-hash';
import { STEERING_TARGETS } from '../specials';
import type { SteeringOverride } from '../specials/types';
import type { EnemyState, SimState } from '../state';
import type { StepContext } from './types';

const LEASH_IN_AGGRO_RADII = 2;
const SEPARATION_WEIGHT = 0.5;
const separation = { x: 0, y: 0 };
const waypoint = { x: 0, y: 0 };

export function enemySteering(ctx: StepContext): void {
  const { state, content, enemyGrid } = ctx;
  const obstacles = ctx.set.obstacles ?? [];
  enemyGrid.rebuild(state.enemies);
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) {
      continue;
    }
    const definition = lookup(content.enemies, enemy.kind, 'enemy');
    chooseTarget(state, enemy, definition);
    if (hasStatus(enemy, 'bubbled')) {
      bubbleDrift(enemy);
      continue;
    }
    if (isRooted(enemy)) {
      continue;
    }
    const disoriented = hasStatus(enemy, 'disoriented');
    let speed = walkingSpeed(enemy);
    let moveX: number;
    let moveY: number;
    if (disoriented) {
      const heading = disorientedHeading(state.tick, enemy);
      moveX = heading.x * speed;
      moveY = heading.y * speed;
    } else {
      const override = steeringOverride(ctx, enemy, definition);
      const target = override?.target ?? targetOf(state, enemy);
      speed *= override?.speedMul ?? 1;
      // A chased player behind a pole is reached once the line clears.
      const detour =
        ctx.flowFields !== undefined &&
        override === undefined &&
        lineBlocked(enemy.x, enemy.y, target.x, target.y, enemy.radius, obstacles) &&
        flowWaypoint(ctx.flowFields, enemy.radius, enemy.x, enemy.y, waypoint);
      const aim = detour ? waypoint : target;
      const dx = aim.x - enemy.x;
      const dy = aim.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const gap = detour ? distance : distance - enemy.radius - target.radius;
      const advance =
        !detour && override === undefined && definition.ranged !== undefined
          ? clamp(gap - definition.ranged.keepDistance, -speed, speed)
          : clamp(gap, 0, speed);
      moveX = distance === 0 ? 0 : (dx / distance) * advance;
      moveY = distance === 0 ? 0 : (dy / distance) * advance;
    }
    if ((definition.behaviour === 'horde' && enemy.ringOf === undefined) || disoriented) {
      separate(state, enemyGrid, enemy);
      moveX += separation.x * speed * SEPARATION_WEIGHT;
      moveY += separation.y * speed * SEPARATION_WEIGHT;
    }
    const fromX = enemy.x;
    const fromY = enemy.y;
    enemy.x = clamp(enemy.x + moveX, enemy.radius, state.arena.width - enemy.radius);
    enemy.y = clamp(enemy.y + moveY, enemy.radius, state.arena.height - enemy.radius);
    resolveObstacles(enemy, fromX, fromY, obstacles);
    const moved = moveX !== 0 || moveY !== 0;
    if (moved && (definition.behaviour === 'heavy' || definition.behaviour === 'boss')) {
      pushTraps(state, content, enemy);
    }
  }
}

function steeringOverride(
  ctx: StepContext,
  enemy: EnemyState,
  definition: EnemyDefinition,
): SteeringOverride | undefined {
  const ring = ringTarget(ctx.state, enemy);
  if (ring !== undefined) {
    return ring;
  }
  const { special } = definition;
  return special === undefined ? undefined : STEERING_TARGETS[special.kind]?.(ctx, enemy, special);
}

function targetOf(state: SimState, enemy: EnemyState): Circle {
  if (enemy.target === 'core') {
    return state.core;
  }
  return playerById(state, enemy.target) ?? state.core;
}

function chooseTarget(state: SimState, enemy: EnemyState, definition: EnemyDefinition): void {
  if (definition.passable === true) {
    enemy.target = 'core';
    return;
  }
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
