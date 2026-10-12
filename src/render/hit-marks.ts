import type { EntityId, SimEvent } from '../sim/state';

export type EnemyHit = Extract<SimEvent, { type: 'enemyHit' }>;

export const SPARK_GAP_TICKS = 4;
export const SPARKS_PER_TICK = 8;
const FORGET_ABOVE = 256;

export interface Contact {
  readonly x: number;
  readonly y: number;
  // Outward, back toward where the hit came from.
  readonly angle: number;
}

export function contactOf(hit: EnemyHit, radius: number): Contact | undefined {
  if (hit.fromX === undefined || hit.fromY === undefined) {
    return undefined;
  }
  const dx = hit.fromX - hit.x;
  const dy = hit.fromY - hit.y;
  if (dx === 0 && dy === 0) {
    return undefined;
  }
  const angle = Math.atan2(dy, dx);
  return { x: hit.x + Math.cos(angle) * radius, y: hit.y + Math.sin(angle) * radius, angle };
}

// A beam hits on every tick: a bad vibe sparks a few times a second, and one step lights a handful.
export class SparkBudget {
  private readonly last = new Map<EntityId, number>();
  private tick = Number.NaN;
  private left = 0;

  tryStart(id: EntityId, tick: number): boolean {
    if (tick !== this.tick) {
      this.tick = tick;
      this.left = SPARKS_PER_TICK;
      if (this.last.size > FORGET_ABOVE) {
        this.forget(tick);
      }
    }
    if (
      this.left === 0 ||
      tick - (this.last.get(id) ?? Number.NEGATIVE_INFINITY) < SPARK_GAP_TICKS
    ) {
      return false;
    }
    this.left -= 1;
    this.last.set(id, tick);
    return true;
  }

  clear(): void {
    this.last.clear();
    this.tick = Number.NaN;
  }

  private forget(tick: number): void {
    for (const [id, last] of this.last) {
      if (tick - last >= SPARK_GAP_TICKS) {
        this.last.delete(id);
      }
    }
  }
}
