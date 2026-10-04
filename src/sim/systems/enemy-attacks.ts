import type { EnemyDefinition } from '../../data/types';
import { lookup } from '../content';
import { damageCore, damagePlayer, playerById } from '../damage';
import type { EnemyState, SimState } from '../state';
import type { StepContext } from './types';

// Steering stops an enemy at contact up to rounding: this slack still counts it as touching.
const CONTACT_SLACK = 1;
export const ENEMY_PROJECTILE_RADIUS = 5;

export function enemyAttacks({ state, content }: StepContext): void {
  for (const enemy of state.enemies) {
    if (enemy.attackCooldown > 0) {
      enemy.attackCooldown -= 1;
    }
    if (enemy.hp <= 0 || enemy.stunTicks > 0 || enemy.attackCooldown > 0) {
      continue;
    }
    const definition = lookup(content.enemies, enemy.kind, 'enemy');
    const attacked =
      definition.ranged === undefined
        ? strike(state, enemy)
        : shoot(state, enemy, definition.ranged);
    if (attacked) {
      enemy.attackCooldown = definition.attackCooldownTicks;
    }
  }
}

function strike(state: SimState, enemy: EnemyState): boolean {
  if (enemy.target === 'core') {
    if (!inContact(enemy, state.core)) {
      return false;
    }
    damageCore(state, enemy.damage);
    return true;
  }
  const player = playerById(state, enemy.target);
  if (player === undefined || player.downed || !inContact(enemy, player)) {
    return false;
  }
  damagePlayer(state, player, enemy.damage);
  return true;
}

function shoot(
  state: SimState,
  enemy: EnemyState,
  ranged: NonNullable<EnemyDefinition['ranged']>,
): boolean {
  const target = enemy.target === 'core' ? state.core : playerById(state, enemy.target);
  if (target === undefined) {
    return false;
  }
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0 || distance - target.radius > ranged.projectileSpeed * ranged.rangeTicks) {
    return false;
  }
  state.projectiles.push({
    id: state.nextEntityId,
    owner: { kind: 'enemy', enemyId: enemy.id },
    x: enemy.x,
    y: enemy.y,
    prevX: enemy.x,
    prevY: enemy.y,
    vx: (dx / distance) * ranged.projectileSpeed,
    vy: (dy / distance) * ranged.projectileSpeed,
    radius: ENEMY_PROJECTILE_RADIUS,
    damage: enemy.damage,
    ticksLeft: ranged.rangeTicks,
    pierceLeft: 0,
  });
  state.nextEntityId += 1;
  return true;
}

function inContact(enemy: EnemyState, target: { x: number; y: number; radius: number }): boolean {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const reach = enemy.radius + target.radius + CONTACT_SLACK;
  return dx * dx + dy * dy <= reach * reach;
}
