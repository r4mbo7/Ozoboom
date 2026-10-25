import type { EnemyDefinition, RecruitDefinition } from '../data/types';
import { clamp } from '../shared/scalar';
import { isBeatTick } from '../shared/tempo';
import { lookup } from './content';
import { playerById } from './damage';
import { hurtEnemy, knockBack, markedDamageMul, touches } from './effects';
import { resolveObstacles } from './obstacles';
import type { EnemyState, PlayerState, RecruitState, SimState } from './state';
import type { StepContext } from './systems/types';

const FOLLOW_DISTANCE = 48;
// A recruit stops against its target: a float slack lets it touch it again after the step.
const CONTACT_SLACK = 1;

// Never a boss (R6) nor a heavy.
export function recruitFallen(
  ctx: StepContext,
  enemy: EnemyState,
  definition: EnemyDefinition,
): void {
  if (enemy.isBoss || definition.behaviour !== 'horde' || enemy.lastHitBy === undefined) {
    return;
  }
  const player = playerById(ctx.state, enemy.lastHitBy);
  if (player === undefined) {
    return;
  }
  const recruits = lookup(ctx.content.classes, player.classId, 'class').recruits;
  if (recruits !== undefined) {
    recruit(ctx, player, enemy, recruits);
  }
}

// The bad vibe keeps its id: the caller removes it from `state.enemies`.
function recruit(
  { state, tempo }: StepContext,
  player: PlayerState,
  enemy: EnemyState,
  definition: RecruitDefinition,
): RecruitState {
  const recruits = (state.recruits ??= []);
  let mine = 0;
  let oldest = -1;
  recruits.forEach((each, index) => {
    if (each.playerId === player.id) {
      mine += 1;
      oldest = oldest < 0 ? index : oldest;
    }
  });
  if (mine >= definition.max && oldest >= 0) {
    const [gone] = recruits.splice(oldest, 1);
    if (gone !== undefined) {
      leave(state, gone);
    }
  }
  const { id, kind, radius, x, y } = enemy;
  const joined: RecruitState = {
    id,
    playerId: player.id,
    kind,
    radius,
    x,
    y,
    prevX: x,
    prevY: y,
    ticksLeft: definition.bars * tempo.ticksPerBar,
  };
  recruits.push(joined);
  state.events.push({ type: 'recruited', id, kind, playerId: player.id, x, y });
  return joined;
}

// After what moves or hurts bad vibes, before `walls` (holds the shoved) and `deaths` (recruits).
export function recruits(ctx: StepContext): void {
  const { state, content, set, tempo } = ctx;
  const list = state.recruits;
  if (list === undefined) {
    return;
  }
  const beat = isBeatTick(state.tick, tempo);
  const markedMul = markedDamageMul(content);
  for (const recruit of list) {
    const player = playerById(state, recruit.playerId);
    if (player === undefined) {
      throw new Error(`recruit of unknown player ${String(recruit.playerId)}`);
    }
    const definition = lookup(content.classes, player.classId, 'class').recruits;
    if (definition === undefined) {
      throw new Error(`class "${player.classId}" has a recruit but no recruits`);
    }
    const target = closestEnemy(state, recruit);
    if (target === undefined) {
      approach(recruit, player.x, player.y, FOLLOW_DISTANCE, definition.speed);
    } else {
      approach(recruit, target.x, target.y, recruit.radius + target.radius, definition.speed);
      if (beat && touches(target, recruit, recruit.radius + CONTACT_SLACK)) {
        hurtEnemy(state, target, definition.damage, markedMul, recruit.playerId, recruit);
        knockBack(target, recruit, definition.knockback);
      }
    }
    recruit.ticksLeft -= 1;
  }
  spreadRecruits(list);
  for (const recruit of list) {
    resolveObstacles(recruit, recruit.prevX, recruit.prevY, set.obstacles ?? []);
  }
  let kept = 0;
  for (const recruit of list) {
    if (recruit.ticksLeft > 0) {
      list[kept] = recruit;
      kept += 1;
    } else {
      leave(state, recruit);
    }
  }
  if (kept === 0) {
    delete state.recruits;
  } else {
    list.length = kept;
  }
}

export function spreadRecruits(list: readonly RecruitState[]): void {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a === undefined) {
      continue;
    }
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b === undefined) {
        continue;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const reach = a.radius + b.radius;
      const squared = dx * dx + dy * dy;
      if (squared >= reach * reach) {
        continue;
      }
      const distance = Math.sqrt(squared);
      const half = (reach - distance) / 2;
      const ux = distance === 0 ? 1 : dx / distance;
      const uy = distance === 0 ? 0 : dy / distance;
      a.x -= ux * half;
      a.y -= uy * half;
      b.x += ux * half;
      b.y += uy * half;
    }
  }
}

function leave(state: SimState, recruit: RecruitState): void {
  const { id, playerId, x, y } = recruit;
  state.events.push({ type: 'recruitLeft', id, playerId, x, y });
}

function closestEnemy(state: SimState, recruit: RecruitState): EnemyState | undefined {
  let closest: EnemyState | undefined;
  let best = Number.POSITIVE_INFINITY;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) {
      continue;
    }
    const dx = enemy.x - recruit.x;
    const dy = enemy.y - recruit.y;
    const squared = dx * dx + dy * dy;
    if (squared < best) {
      best = squared;
      closest = enemy;
    }
  }
  return closest;
}

function approach(
  recruit: RecruitState,
  x: number,
  y: number,
  stopAt: number,
  speed: number,
): void {
  const dx = x - recruit.x;
  const dy = y - recruit.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance === 0) {
    return;
  }
  const advance = clamp(distance - stopAt, 0, speed);
  recruit.x += (dx / distance) * advance;
  recruit.y += (dy / distance) * advance;
}
