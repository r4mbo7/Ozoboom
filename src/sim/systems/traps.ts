import type { TrapCadence, TrapDefinition, TrapEffect } from '../../data/types';
import { isBeatTick, type Tempo } from '../../shared/tempo';
import { blackedOut } from '../blackout';
import { inBreeze } from '../breeze';
import { lookup, type ResolvedContent } from '../content';
import {
  drawTo,
  healPlayer,
  healPlayersOnBar,
  hurtEnemy,
  markEnemy,
  shockwave,
  slowEnemies,
  wholeTicks,
} from '../effects';
import type { Obstacles } from '../obstacles';
import { trapPointing } from '../pointing';
import type { SpatialHash } from '../spatial-hash';
import type { EnemyState, PlayerId, PlayerState, SimState, TrapState, Vec2 } from '../state';
import { moveTrap } from '../trap-moves';
import { rechargeTraps, trapPower, wearTraps } from '../trap-wear';
import { FULL_STEPS } from '../full';
import { statValue } from '../stats';
import type { StepContext } from './types';

// Marks the lure does not renew lapse after the next tick, whose earlier systems still see it.
const LURE_MARK_TICKS = 2;

export interface Emitter extends Vec2 {
  direction: Vec2;
}

export interface Firing {
  state: SimState;
  tempo: Tempo;
  at: Emitter;
  effect: TrapEffect;
  contact: number;
  by: PlayerId | null;
  power: number;
  damageMul: number;
  radiusMul: number;
  obstacles: Obstacles;
  // Holds the bad vibes where they stand: `fire` rebuilds it after an effect that moves them.
  enemyGrid: SpatialHash;
}

export function traps(ctx: StepContext): void {
  const { state, content, commands } = ctx;
  for (const player of state.players) {
    for (const action of commands.get(player.id)?.actions ?? []) {
      if (action.type === 'moveTrap' && FULL_STEPS.tookPoseKey?.(ctx, player.id) !== true) {
        moveTrap(ctx, player);
      }
    }
  }

  if (state.traps.length > 0) {
    ctx.enemyGrid.rebuild(state.enemies);
  }
  const firing = cadencesFiring(state);
  const silent = blackedOut(state);
  const fireAll = (lures: boolean) => {
    for (const trap of state.traps) {
      const definition = trapDefinition(content, trap);
      const shorted = (trap.shortedTicks ?? 0) > 0;
      const lure = definition.effect.kind === 'lure';
      if (firing[definition.cadence] && lure === lures && !shorted && !silent) {
        const owner = ownerOf(state, trap);
        const power = trapPower(trap, ctx.set.trapWear);
        const reached = fire({
          state,
          tempo: ctx.tempo,
          at: trap,
          effect: definition.effect,
          contact: definition.radius,
          by: trap.ownerId,
          power,
          damageMul: statValue(owner, 'trapDamageMul', 1) * power,
          radiusMul: statValue(owner, 'trapRadiusMul', 1) * power,
          obstacles: ctx.enemyObstacles,
          enemyGrid: ctx.enemyGrid,
        });
        if (reached || definition.cadence !== 'continuous') {
          const { id, kind, x, y } = trap;
          state.events.push({ type: 'trapFired', id, kind, x, y });
        }
      }
    }
  };

  fireAll(true);
  for (const enemy of state.enemies) {
    enemy.slowFactor = 1;
    enemy.stunTicks = Math.max(0, enemy.stunTicks - 1);
  }
  fireAll(false);
  for (const trap of state.traps) {
    if (trap.shortedTicks !== undefined) {
      trap.shortedTicks -= 1;
      if (trap.shortedTicks <= 0) {
        delete trap.shortedTicks;
      }
    }
  }
  rechargeTraps(ctx);
  wearTraps(ctx);
}

function cadencesFiring(state: SimState): Readonly<Record<TrapCadence, boolean>> {
  let beat = false;
  let bar = false;
  let drop = false;
  for (const event of state.events) {
    beat ||= event.type === 'beat';
    bar ||= event.type === 'bar';
    drop ||= event.type === 'segment' && event.segment === 'drop';
  }
  return { beat, bar, drop, continuous: true };
}

export function fire(firing: Firing): boolean {
  const { state, tempo, at, effect, contact, by, power, damageMul, radiusMul, obstacles } = firing;
  const grid = firing.enemyGrid;
  let reached = false;
  switch (effect.kind) {
    case 'shockwave':
      return shockwave(
        state,
        grid,
        at,
        effect.radius * radiusMul,
        effect.damage * damageMul,
        effect.knockback * power,
        by,
        obstacles,
      );
    case 'beam': {
      const direction = trapPointing(effect, at.direction, state.tick, tempo);
      const before = trapPointing(effect, at.direction, state.tick - 1, tempo);
      const length = effect.length * radiusMul;
      // Around the beam, wide enough for a bad vibe at its far corner and for the arc its far
      // end swept since the last tick.
      const turnX = direction.x - before.x;
      const turnY = direction.y - before.y;
      const widest = grid.widestRadius();
      const swept = (length + widest) * Math.sqrt(turnX * turnX + turnY * turnY);
      const found = grid.querySegmentInListOrder(
        at.x,
        at.y,
        at.x + direction.x * length,
        at.y + direction.y * length,
        effect.width / 2 + swept + widest,
      );
      for (let i = 0; i < found; i++) {
        const enemy = state.enemies[grid.result(i)];
        if (
          enemy !== undefined &&
          enemy.hp > 0 &&
          (inBeam(enemy, at, direction, length, effect.width / 2) ||
            sweptOver(enemy, at, before, direction, length))
        ) {
          hurtEnemy(state, enemy, effect.damagePerTick * damageMul, by, at);
          reached = true;
        }
      }
      return reached;
    }
    case 'mist': {
      const radius = effect.radius * radiusMul;
      healPlayersOnBar(state, tempo, at, radius, effect.healPerBar * power);
      return slowEnemies(state, grid, at, radius, weakened(effect.slowFactor, power));
    }
    case 'lure': {
      const found = grid.queryInListOrder(at.x, at.y, effect.radius * radiusMul);
      for (let i = 0; i < found; i++) {
        const enemy = state.enemies[grid.result(i)];
        if (enemy !== undefined && enemy.hp > 0) {
          markEnemy(state, enemy, 'lure', effect.markedDamageMul, LURE_MARK_TICKS);
          drawTo(enemy, at, contact + enemy.radius, obstacles);
          reached = true;
        }
      }
      if (reached) {
        grid.rebuild(state.enemies);
      }
      return reached;
    }
    case 'strobe': {
      // The longest stun wins, in any order.
      const stun = wholeTicks(effect.stunTicks * power);
      const found = grid.query(at.x, at.y, effect.radius * radiusMul);
      for (let i = 0; i < found; i++) {
        const enemy = state.enemies[grid.result(i)];
        if (enemy !== undefined && enemy.hp > 0) {
          enemy.stunTicks = Math.max(enemy.stunTicks, stun);
          reached = true;
        }
      }
      return reached;
    }
    case 'breeze': {
      const direction = trapPointing(effect, at.direction, state.tick, tempo);
      const length = effect.length * radiusMul;
      const blows = (body: Vec2 & { radius: number }) =>
        inBreeze(body, at, direction, length, effect.coneDegrees);
      if (isBeatTick(state.tick, tempo)) {
        for (const player of state.players) {
          if (!player.downed && blows(player)) {
            healPlayer(state, player, effect.healPerBeat * power);
          }
        }
      }
      // The strongest slow wins, in any order.
      const found = grid.query(at.x, at.y, length);
      for (let i = 0; i < found; i++) {
        const enemy = state.enemies[grid.result(i)];
        if (enemy !== undefined && enemy.hp > 0 && blows(enemy)) {
          enemy.slowFactor = Math.min(enemy.slowFactor, weakened(effect.slowFactor, power));
          reached = true;
        }
      }
      return reached;
    }
  }
}

// A slow factor `power` times as strong: 1 slows nothing.
function weakened(slowFactor: number, power: number): number {
  return 1 - (1 - slowFactor) * power;
}

function inBeam(
  enemy: EnemyState,
  trap: Vec2,
  direction: Vec2,
  length: number,
  halfWidth: number,
): boolean {
  const dx = enemy.x - trap.x;
  const dy = enemy.y - trap.y;
  const along = dx * direction.x + dy * direction.y;
  const across = Math.abs(dx * direction.y - dy * direction.x);
  return (
    along >= -enemy.radius && along <= length + enemy.radius && across <= halfWidth + enemy.radius
  );
}

// Far out, a sweeping beam turns further in a step than it is wide: what it passed over is hit too.
function sweptOver(enemy: EnemyState, trap: Vec2, from: Vec2, to: Vec2, length: number): boolean {
  const turn = from.x * to.y - from.y * to.x;
  if (turn === 0) {
    return false;
  }
  const dx = enemy.x - trap.x;
  const dy = enemy.y - trap.y;
  const reach = length + enemy.radius;
  return (
    dx * dx + dy * dy <= reach * reach &&
    (from.x * dy - from.y * dx) * turn >= 0 &&
    (dx * to.y - dy * to.x) * turn >= 0
  );
}

function trapDefinition(content: ResolvedContent, trap: TrapState): TrapDefinition {
  return lookup(content.traps, trap.kind, 'trap');
}

function ownerOf(state: SimState, trap: TrapState): PlayerState {
  const owner = state.players.find((player) => player.id === trap.ownerId);
  if (owner === undefined) {
    throw new Error(`trap ${String(trap.id)} has no owner ${String(trap.ownerId)}`);
  }
  return owner;
}
