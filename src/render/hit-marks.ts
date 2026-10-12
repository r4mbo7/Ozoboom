import { TICKS_PER_BEAT } from '../shared/tempo';
import type { EntityId, PlayerId, SimEvent } from '../sim/state';

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

export const CRACK_STAGES = 3;

// 0 while unhurt, then one more crack for each third of its life a bad vibe has lost.
export function crackStage(hp: number, maxHp: number): number {
  if (hp >= maxHp) {
    return 0;
  }
  const lost = ((maxHp - Math.max(hp, 0)) * CRACK_STAGES) / maxHp;
  return Math.min(CRACK_STAGES, Math.ceil(lost - 1e-9));
}

export const NUMBER_GAP_TICKS = TICKS_PER_BEAT / 2;

export interface Tallied {
  id: EntityId;
  x: number;
  y: number;
  by: PlayerId | undefined;
  amount: number;
}

interface Tally extends Tallied {
  lastHit: number;
  shownAt: number;
}

// The hits on one bad vibe add up into the number shown above it, one per gap at most: a beam that
// hits on every tick shows what it did in half a beat, not a number per tick.
export class DamageTally {
  private readonly tallies = new Map<EntityId, Tally>();

  get size(): number {
    return this.tallies.size;
  }

  add(hit: EnemyHit, tick: number): void {
    let tally = this.tallies.get(hit.id);
    if (tally === undefined) {
      tally = {
        id: hit.id,
        x: 0,
        y: 0,
        by: undefined,
        amount: 0,
        lastHit: 0,
        shownAt: Number.NEGATIVE_INFINITY,
      };
      this.tallies.set(hit.id, tally);
    }
    tally.x = hit.x;
    tally.y = hit.y;
    tally.by = hit.by;
    tally.amount += hit.damage;
    tally.lastHit = tick;
  }

  // `show` receives each number that is due; the object it is handed is reused afterwards.
  flush(tick: number, show: (number: Tallied) => void): void {
    for (const tally of this.tallies.values()) {
      if (tick - tally.shownAt < NUMBER_GAP_TICKS) {
        continue;
      }
      const amount = Math.round(tally.amount);
      if (amount >= 1) {
        tally.amount = amount;
        show(tally);
        tally.amount = 0;
        tally.shownAt = tick;
      } else if (tick - tally.lastHit >= NUMBER_GAP_TICKS) {
        this.tallies.delete(tally.id);
      }
    }
  }

  clear(): void {
    this.tallies.clear();
  }
}

export const HEAVY_SHARE = 0.5;
export const HOLD_TICKS = 2;

// A heavy hit takes at one go this share of the full life of a bad vibe, and leaves it standing.
export function isHeavy(
  hit: EnemyHit,
  enemy: { readonly hp: number; readonly maxHp: number } | undefined,
): boolean {
  return enemy !== undefined && enemy.hp > 0 && hit.damage >= HEAVY_SHARE * enemy.maxHp;
}
