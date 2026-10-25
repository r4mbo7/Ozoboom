import { unitFromAngle } from '../shared/angle';
import type { Vec2 } from '../shared/vec';
import type { EnemyState, EnemyStatusKind, SimState } from './state';
import type { StepContext } from './systems/types';

const STATUS_KINDS: readonly EnemyStatusKind[] = [
  'slowed',
  'halfTime',
  'disoriented',
  'bubbled',
  'eating',
  'held',
  'frozen',
];
const SLOWED_SPEED_MUL = 0.5;
const HALF_TIME_COOLDOWN_MUL = 2;
const BUBBLE_DRIFT_SPEED = 0.6;
const DISORIENTED_HEADING_COUNT = 12;
const DISORIENTED_TICKS_PER_HEADING = 4;
const DISORIENTED_HEADINGS: readonly Vec2[] = Array.from(
  { length: DISORIENTED_HEADING_COUNT },
  (_, i) => unitFromAngle((2 * Math.PI * i) / DISORIENTED_HEADING_COUNT),
);

// A boss is only ever slowed (R6): any other status lands on it as `slowed`.
export function applyEnemyStatus(
  state: SimState,
  enemy: EnemyState,
  kind: EnemyStatusKind,
  ticks: number,
): void {
  if (enemy.hp <= 0 || ticks <= 0) {
    return;
  }
  const status = enemy.isBoss ? 'slowed' : kind;
  const statuses = (enemy.statuses ??= {});
  const left = statuses[status];
  if (left === undefined) {
    const { id, x, y } = enemy;
    state.events.push({ type: 'enemyStatusStarted', id, status, x, y });
  }
  statuses[status] = Math.max(left ?? 0, ticks);
}

export function hasStatus(enemy: EnemyState, kind: EnemyStatusKind): boolean {
  return enemy.statuses?.[kind] !== undefined;
}

export function isRooted(enemy: EnemyState): boolean {
  const statuses = enemy.statuses;
  return (
    enemy.stunTicks > 0 ||
    (statuses !== undefined &&
      (statuses.frozen !== undefined ||
        statuses.held !== undefined ||
        statuses.eating !== undefined ||
        statuses.bubbled !== undefined))
  );
}

export function walkingSpeed(enemy: EnemyState): number {
  const statuses = enemy.statuses;
  if (
    statuses === undefined ||
    (statuses.slowed === undefined && statuses.halfTime === undefined)
  ) {
    return enemy.speed * enemy.slowFactor;
  }
  return enemy.speed * Math.min(enemy.slowFactor, SLOWED_SPEED_MUL);
}

export function canStrike(enemy: EnemyState): boolean {
  const statuses = enemy.statuses;
  return (
    enemy.stunTicks <= 0 &&
    (statuses === undefined ||
      (statuses.frozen === undefined &&
        statuses.eating === undefined &&
        statuses.bubbled === undefined &&
        statuses.disoriented === undefined))
  );
}

export function strikeCooldownMul(enemy: EnemyState): number {
  return hasStatus(enemy, 'halfTime') ? HALF_TIME_COOLDOWN_MUL : 1;
}

export function disorientedHeading(tick: number, enemy: EnemyState): Vec2 {
  const index =
    (Math.floor(tick / DISORIENTED_TICKS_PER_HEADING) + enemy.id) % DISORIENTED_HEADING_COUNT;
  return DISORIENTED_HEADINGS[index] ?? { x: 1, y: 0 };
}

export function bubbleDrift(enemy: EnemyState): void {
  enemy.y = Math.max(enemy.radius, enemy.y - BUBBLE_DRIFT_SPEED);
}

// After the last system that reads them: a status posed for n ticks rules n steps.
export function enemyStatuses({ state }: StepContext): void {
  for (const enemy of state.enemies) {
    const statuses = enemy.statuses;
    if (statuses === undefined) {
      continue;
    }
    let ended = false;
    for (const status of STATUS_KINDS) {
      const left = statuses[status];
      if (left === undefined) {
        continue;
      }
      statuses[status] = left - 1;
      if (left === 1) {
        ended = true;
        const { id, x, y } = enemy;
        state.events.push({ type: 'enemyStatusEnded', id, status, x, y });
      }
    }
    if (!ended) {
      continue;
    }
    const kept = stillRunning(statuses);
    if (kept === undefined) {
      delete enemy.statuses;
    } else {
      enemy.statuses = kept;
    }
  }
}

function stillRunning(
  statuses: Partial<Record<EnemyStatusKind, number>>,
): Partial<Record<EnemyStatusKind, number>> | undefined {
  let kept: Partial<Record<EnemyStatusKind, number>> | undefined;
  for (const status of STATUS_KINDS) {
    const left = statuses[status];
    if (left !== undefined && left > 0) {
      (kept ??= {})[status] = left;
    }
  }
  return kept;
}
