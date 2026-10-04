import type { ResolvedContent } from './content';
import type { EnemyState, SimState } from './state';

interface Point {
  x: number;
  y: number;
}

interface Circle extends Point {
  radius: number;
}

export function touches(body: Circle, center: Point, radius: number): boolean {
  const dx = body.x - center.x;
  const dy = body.y - center.y;
  const reach = radius + body.radius;
  return dx * dx + dy * dy <= reach * reach;
}

export function pushAway(body: Point, from: Point, distance: number): void {
  const dx = body.x - from.x;
  const dy = body.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) {
    body.x += distance;
    return;
  }
  body.x += (dx / length) * distance;
  body.y += (dy / length) * distance;
}

export function markedDamageMul(content: ResolvedContent): number {
  let mul = 1;
  for (const trap of content.traps.values()) {
    if (trap.effect.kind === 'lure') {
      mul = Math.max(mul, trap.effect.markedDamageMul);
    }
  }
  return mul;
}

export function hurtEnemy(
  state: SimState,
  enemy: EnemyState,
  damage: number,
  markedMul: number,
): void {
  if (enemy.hp <= 0) {
    return;
  }
  const dealt = enemy.marked ? damage * markedMul : damage;
  enemy.hp -= dealt;
  state.stats.damageDealt += dealt;
  state.events.push({ type: 'enemyHit', id: enemy.id, damage: dealt, x: enemy.x, y: enemy.y });
}

export function compound(factor: number, times: number): number {
  let value = 1;
  for (let i = 0; i < times; i++) {
    value *= factor;
  }
  return value;
}

export function wholeTicks(ticks: number): number {
  return Math.floor(ticks + 0.5);
}

export function keepWhere<T>(items: T[], keep: (item: T) => boolean): void {
  let kept = 0;
  for (const item of items) {
    if (keep(item)) {
      items[kept] = item;
      kept += 1;
    }
  }
  items.length = kept;
}
