import type { TrapCadence, TrapDefinition, TrapEffect } from '../../data/types';
import { isBeatTick, type Tempo } from '../../shared/tempo';
import { normalize } from '../../shared/vec';
import { inBreeze } from '../breeze';
import type { PlayerAction } from '../commands';
import { lookup, type ResolvedContent } from '../content';
import {
  drawTo,
  healPlayer,
  healPlayersOnBar,
  hurtEnemy,
  markEnemy,
  markedDamageMul,
  shockwave,
  slowEnemies,
  touches,
  wholeTicks,
} from '../effects';
import { touchesObstacle } from '../obstacles';
import { trapPointing } from '../pointing';
import type { EnemyState, PlayerId, PlayerState, SimState, TrapState, Vec2 } from '../state';
import { statValue, trapCapacity } from '../stats';
import type { StepContext } from './types';

// Marks the lure does not renew lapse after the next tick, whose earlier systems still see it.
const LURE_MARK_TICKS = 2;

type PlaceTrap = Extract<PlayerAction, { type: 'placeTrap' }>;
type TakeTrap = Extract<PlayerAction, { type: 'takeTrap' }>;

export interface Emitter extends Vec2 {
  direction: Vec2;
}

export interface Firing {
  state: SimState;
  tempo: Tempo;
  at: Emitter;
  effect: TrapEffect;
  // Half-width of the emitter body: the lure stops its prey there.
  contact: number;
  by: PlayerId | null;
  power: number;
  damageMul: number;
  radiusMul: number;
  markedMul: number;
}

export function traps(ctx: StepContext): void {
  const { state, content, commands } = ctx;
  for (const player of state.players) {
    for (const action of commands.get(player.id)?.actions ?? []) {
      if (action.type === 'placeTrap' || action.type === 'takeTrap') {
        useTrapSpot(ctx, player, action);
      }
    }
  }

  const firing = cadencesFiring(state);
  const markedMul = markedDamageMul(content);
  const fireAll = (lures: boolean) => {
    for (const trap of state.traps) {
      const definition = trapDefinition(content, trap);
      const shorted = (trap.shortedTicks ?? 0) > 0;
      if (firing[definition.cadence] && (definition.effect.kind === 'lure') === lures && !shorted) {
        const owner = ownerOf(state, trap);
        const reached = fire({
          state,
          tempo: ctx.tempo,
          at: trap,
          effect: definition.effect,
          contact: definition.radius,
          by: trap.ownerId,
          power: 1,
          damageMul: statValue(owner, 'trapDamageMul', 1),
          radiusMul: statValue(owner, 'trapRadiusMul', 1),
          markedMul,
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
}

// A trap on the spot is taken back when a hand is free; free ground takes the trap placed.
function useTrapSpot(ctx: StepContext, player: PlayerState, action: PlaceTrap | TakeTrap): void {
  if (player.downed) {
    return;
  }
  const { state, content, set } = ctx;
  const under = trapAt(content.traps, state.traps, action);
  if (under !== undefined) {
    if ((player.hand?.length ?? 0) < set.handSize) {
      state.traps.splice(state.traps.indexOf(under), 1);
      (player.hand ??= []).push(under.kind);
      const { id, kind, x, y } = under;
      state.events.push({ type: 'trapTaken', id, kind, playerId: player.id, x, y });
    }
    return;
  }
  if (action.type === 'placeTrap') {
    placeTrap(ctx, player, action);
  }
}

function placeTrap({ state, content, set }: StepContext, player: PlayerState, action: PlaceTrap) {
  const definition = content.traps.get(action.trapId);
  const held = player.hand?.indexOf(action.trapId) ?? -1;
  if (definition === undefined || held < 0) {
    return;
  }

  const { x, y } = action;

  const { radius } = definition;
  const { arena, core } = state;
  const footprint = { x, y, radius };
  const fits =
    x >= radius &&
    x <= arena.width - radius &&
    y >= radius &&
    y <= arena.height - radius &&
    !overlaps(footprint, core, core.radius) &&
    !touchesObstacle(footprint, set.obstacles ?? []) &&
    !state.traps.some((trap) => overlaps(footprint, trap, trapDefinition(content, trap).radius)) &&
    state.traps.length < trapCapacity(set, state);
  if (!fits) {
    return;
  }

  const id = state.nextEntityId;
  state.nextEntityId += 1;
  state.traps.push({
    id,
    kind: definition.id,
    ownerId: player.id,
    x,
    y,
    prevX: x,
    prevY: y,
    direction: facing(action, player),
  });
  player.hand?.splice(held, 1);
  state.events.push({ type: 'trapPlaced', id, kind: definition.id, x, y });
}

export function trapAt(
  definitions: ReadonlyMap<string, Pick<TrapDefinition, 'radius'>>,
  traps: readonly TrapState[],
  { x, y }: Vec2,
): TrapState | undefined {
  return traps.find((trap) =>
    touches({ x, y, radius: 0 }, trap, lookup(definitions, trap.kind, 'trap').radius),
  );
}

function facing(action: PlaceTrap, player: PlayerState): Vec2 {
  const direction = normalize({ x: action.dx, y: action.dy });
  return direction.x === 0 && direction.y === 0 ? player.aim : direction;
}

function overlaps(
  body: { x: number; y: number; radius: number },
  center: { x: number; y: number },
  radius: number,
): boolean {
  const dx = body.x - center.x;
  const dy = body.y - center.y;
  const reach = radius + body.radius;
  return dx * dx + dy * dy < reach * reach;
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

// Says whether the effect reached a bad vibe.
export function fire(firing: Firing): boolean {
  const { state, tempo, at, effect, contact, by, power, damageMul, radiusMul, markedMul } = firing;
  let reached = false;
  switch (effect.kind) {
    case 'shockwave':
      return shockwave(
        state,
        at,
        effect.radius * radiusMul,
        effect.damage * damageMul,
        effect.knockback,
        markedMul,
        by,
      );
    case 'beam': {
      const direction = trapPointing(effect, at.direction, state.tick, tempo);
      const before = trapPointing(effect, at.direction, state.tick - 1, tempo);
      const length = effect.length * radiusMul;
      for (const enemy of state.enemies) {
        if (
          enemy.hp > 0 &&
          (inBeam(enemy, at, direction, length, effect.width / 2) ||
            sweptOver(enemy, at, before, direction, length))
        ) {
          hurtEnemy(state, enemy, effect.damagePerTick * damageMul, markedMul, by, at);
          reached = true;
        }
      }
      return reached;
    }
    case 'mist': {
      const radius = effect.radius * radiusMul;
      healPlayersOnBar(state, tempo, at, radius, effect.healPerBar * power);
      return slowEnemies(state, at, radius, effect.slowFactor);
    }
    case 'lure':
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && touches(enemy, at, effect.radius * radiusMul)) {
          markEnemy(state, enemy, LURE_MARK_TICKS);
          drawTo(enemy, at, contact + enemy.radius);
          reached = true;
        }
      }
      return reached;
    case 'strobe': {
      const stun = wholeTicks(effect.stunTicks * power);
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && touches(enemy, at, effect.radius * radiusMul)) {
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
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && blows(enemy)) {
          enemy.slowFactor = Math.min(enemy.slowFactor, effect.slowFactor);
          reached = true;
        }
      }
      return reached;
    }
  }
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
