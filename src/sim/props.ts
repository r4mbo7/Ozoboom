import { hurtEnemy, touches } from './effects';
import { touchesObstacle } from './obstacles';
import type { PlayerState, PropState, SimState, Vec2 } from './state';
import type { StepContext } from './systems/types';

export function ownerOf(state: SimState, prop: PropState): PlayerState {
  const owner = state.players.find((player) => player.id === prop.playerId);
  if (owner === undefined) {
    throw new Error(`${prop.kind} ${String(prop.id)} has no owner ${String(prop.playerId)}`);
  }
  return owner;
}

export function flyBack(prop: PropState, owner: PlayerState, speed: number): void {
  const dx = owner.x - prop.x;
  const dy = owner.y - prop.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= speed + owner.radius) {
    prop.phase = 'held';
    prop.x = owner.x;
    prop.y = owner.y;
    prop.vx = prop.vy = 0;
    return;
  }
  prop.vx = (dx / distance) * speed;
  prop.vy = (dy / distance) * speed;
  prop.x += prop.vx;
  prop.y += prop.vy;
}

export function closeIn(prop: PropState, to: Vec2, reach: number, speed: number): boolean {
  const dx = to.x - prop.x;
  const dy = to.y - prop.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= speed + reach) {
    prop.x = to.x;
    prop.y = to.y;
    return true;
  }
  prop.vx = (dx / distance) * speed;
  prop.vy = (dy / distance) * speed;
  prop.x += prop.vx;
  prop.y += prop.vy;
  return false;
}

// True once the prop has spent its hits on the bad vibes it touched on the way.
export function flyThrough(
  ctx: Pick<StepContext, 'state' | 'content'>,
  prop: PropState,
  owner: PlayerState,
  radius: number,
): boolean {
  const { state } = ctx;
  prop.x += prop.vx;
  prop.y += prop.vy;
  prop.ticksLeft -= 1;
  for (const enemy of state.enemies) {
    if (enemy.hp > 0 && prop.hitIds?.includes(enemy.id) !== true && touches(enemy, prop, radius)) {
      hurtEnemy(state, enemy, prop.damage, owner.id, { x: prop.prevX, y: prop.prevY });
      (prop.hitIds ??= []).push(enemy.id);
      prop.hitsLeft -= 1;
      if (prop.hitsLeft <= 0) {
        return true;
      }
    }
  }
  return false;
}

export function flightOver(
  { state, set }: Pick<StepContext, 'state' | 'set'>,
  prop: PropState,
  radius: number,
): boolean {
  const { width, height } = state.arena;
  const out = prop.x < 0 || prop.x > width || prop.y < 0 || prop.y > height;
  return (
    out ||
    prop.ticksLeft <= 0 ||
    touchesObstacle({ x: prop.x, y: prop.y, radius }, set.obstacles ?? [])
  );
}
