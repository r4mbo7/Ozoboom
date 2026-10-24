import type { SteeringOverride } from './specials/types';
import type { EnemyState, SimState, Vec2 } from './state';
import type { StepContext } from './systems/types';

export const RING_SIZE = 8;
// The ring's heading turns this notch every tick: a turn in 96 ticks, three seconds and a bit.
const NOTCH = { x: 0.9978589232386035, y: 0.06540312923014306 };
// An eighth of a turn, from one place of the ring to the next.
const EIGHTH = { x: 0.7071067811865476, y: 0.7071067811865476 };
// The ring is a little flatter than round, as seen from the dance floor.
const SQUASH = 0.9;
// A member hurries to its place this many times faster than it walks.
const SPEED_MUL = 3;

function turned(v: Vec2, by: Vec2): Vec2 {
  return { x: v.x * by.x - v.y * by.y, y: v.x * by.y + v.y * by.x };
}

// Turns the ring's heading a notch, kept a unit vector.
export function turnRing(ring: { x: number; y: number }): void {
  const { x, y } = turned(ring, NOTCH);
  const length = Math.sqrt(x * x + y * y) || 1;
  ring.x = x / length;
  ring.y = y / length;
}

// Where place `slot` of the ring points, from its heading.
export function ringSlot(heading: Vec2, slot: number): Vec2 {
  let v: Vec2 = { x: heading.x, y: heading.y };
  for (let turn = 0; turn < slot; turn += 1) {
    v = turned(v, EIGHTH);
  }
  return v;
}

// Where a member of a ring walks to: its place round the boss, at `orbit`. Undefined for a bad
// vibe in no ring, or whose boss is gone.
export function ringTarget(state: SimState, enemy: EnemyState): SteeringOverride | undefined {
  const { ringOf } = enemy;
  if (ringOf === undefined) {
    return undefined;
  }
  const boss = state.enemies.find((other) => other.id === ringOf.id);
  if (boss?.ring === undefined || boss.hp <= 0) {
    return undefined;
  }
  const place = ringSlot(boss.ring, ringOf.slot);
  return {
    target: {
      x: boss.x + place.x * ringOf.orbit,
      y: boss.y + place.y * ringOf.orbit * SQUASH,
      radius: 0,
    },
    speedMul: SPEED_MUL,
  };
}

// Before the deaths: the ring of a boss chased goes with him, each member smiling in the color of
// a player in turn; the ring of a boss gone otherwise is set free.
export function rings({ state }: StepContext): void {
  for (const enemy of state.enemies) {
    const { ringOf } = enemy;
    if (ringOf === undefined) {
      continue;
    }
    const boss = state.enemies.find((other) => other.id === ringOf.id);
    if (boss === undefined) {
      delete enemy.ringOf;
    } else if (boss.hp <= 0 && enemy.hp > 0) {
      enemy.hp = 0;
      const player = state.players[ringOf.slot % state.players.length];
      if (player !== undefined) {
        enemy.lastHitBy = player.id;
      }
      delete enemy.ringOf;
    }
  }
}
