import { isBarTick } from '../shared/tempo';
import type { ResolvedContent } from './content';
import type { EnemyState, PlayerId, PlayerState, SimState } from './state';

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

export function markEnemy(state: SimState, enemy: EnemyState, ticks: number): void {
  enemy.marked = true;
  enemy.markedUntilTick = Math.max(enemy.markedUntilTick ?? 0, state.tick + ticks);
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

// `by` is the player credited with the hit: the shooter, the owner of the trap or the caster.
export function hurtEnemy(
  state: SimState,
  enemy: EnemyState,
  damage: number,
  markedMul: number,
  by: PlayerId | null,
): void {
  if (enemy.hp <= 0) {
    return;
  }
  const dealt = enemy.marked ? damage * markedMul : damage;
  enemy.hp -= dealt;
  if (by !== null) {
    enemy.lastHitBy = by;
  }
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

export function slowEnemies(state: SimState, at: Point, radius: number, slowFactor: number): void {
  for (const enemy of state.enemies) {
    if (enemy.hp > 0 && touches(enemy, at, radius)) {
      enemy.slowFactor = Math.min(enemy.slowFactor, slowFactor);
    }
  }
}

export function healPlayer(player: PlayerState, amount: number): void {
  player.hp = Math.min(player.maxHp, player.hp + amount);
}

// Heals once per bar, on the bar tick.
export function healPlayersOnBar(state: SimState, at: Point, radius: number, amount: number): void {
  if (!isBarTick(state.tick)) {
    return;
  }
  for (const player of state.players) {
    if (!player.downed && touches(player, at, radius)) {
      healPlayer(player, amount);
    }
  }
}

export function shockwave(
  state: SimState,
  at: Point,
  radius: number,
  damage: number,
  knockback: number,
  markedMul: number,
  by: PlayerId | null,
): void {
  for (const enemy of state.enemies) {
    if (enemy.hp > 0 && touches(enemy, at, radius)) {
      hurtEnemy(state, enemy, damage, markedMul, by);
      pushAway(enemy, at, knockback);
    }
  }
}

// The lure replaces the step the steering just gave the enemy: same speed, slow and stun, new goal.
export function drawTo(enemy: EnemyState, at: Point, contact: number): void {
  const step = enemy.stunTicks > 0 ? 0 : enemy.speed * enemy.slowFactor;
  const dx = at.x - enemy.prevX;
  const dy = at.y - enemy.prevY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const travel = Math.max(0, Math.min(step, distance - contact));
  enemy.x = distance === 0 ? enemy.prevX : enemy.prevX + (dx / distance) * travel;
  enemy.y = distance === 0 ? enemy.prevY : enemy.prevY + (dy / distance) * travel;
}
