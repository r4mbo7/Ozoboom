import type { TrapCadence, TrapDefinition, TrapEffect } from '../../data/types';
import { normalize } from '../../shared/vec';
import type { PlayerAction } from '../commands';
import { lookup, type ResolvedContent } from '../content';
import {
  compound,
  drawTo,
  healPlayersOnBar,
  hurtEnemy,
  keepWhere,
  markEnemy,
  markedDamageMul,
  shockwave,
  slowEnemies,
  touches,
  wholeTicks,
} from '../effects';
import type { EnemyState, PlayerId, PlayerState, SimState, TrapState, Vec2 } from '../state';
import { statValue, trapCapacity } from '../stats';
import type { StepContext } from './types';

// Marks the lure does not renew lapse after the next tick, whose earlier systems still see it.
const LURE_MARK_TICKS = 2;

type PlaceTrap = Extract<PlayerAction, { type: 'placeTrap' }>;

export interface Emitter extends Vec2 {
  direction: Vec2;
}

export interface Firing {
  state: SimState;
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
      if (action.type === 'placeTrap') {
        placeTrap(ctx, player, action);
      }
    }
  }

  const firing = cadencesFiring(state);
  const markedMul = markedDamageMul(content);
  const fireAll = (lures: boolean) => {
    for (const trap of state.traps) {
      const definition = trapDefinition(content, trap);
      if (firing[definition.cadence] && (definition.effect.kind === 'lure') === lures) {
        const owner = ownerOf(state, trap);
        const power = compound(definition.levelMul, trap.level - 1);
        state.events.push({
          type: 'trapFired',
          id: trap.id,
          kind: trap.kind,
          x: trap.x,
          y: trap.y,
        });
        fire({
          state,
          at: trap,
          effect: definition.effect,
          contact: definition.radius,
          by: trap.ownerId,
          power,
          damageMul: power * statValue(owner, 'trapDamageMul', 1),
          radiusMul: statValue(owner, 'trapRadiusMul', 1),
          markedMul,
        });
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
    takeHeavyBlows(state, content, trap);
  }
  removeBrokenTraps(state);
}

function placeTrap({ state, content, set }: StepContext, player: PlayerState, action: PlaceTrap) {
  const definition = content.traps.get(action.trapId);
  if (definition === undefined || player.downed) {
    return;
  }
  const under = trapAt(content.traps, state.traps, action);
  const cost = actionCost(definition, under, player);
  if (cost === null || state.core.watts < cost) {
    return;
  }

  if (under !== undefined) {
    under.level += 1;
    pay(state, cost);
    const { id, kind, level } = under;
    state.events.push({ type: 'trapUpgraded', id, kind, level, x: under.x, y: under.y });
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
    level: 1,
    x,
    y,
    prevX: x,
    prevY: y,
    direction: facing(action, player),
    hp: definition.hp,
    cooldown: 0,
  });
  pay(state, cost);
  state.events.push({ type: 'trapPlaced', id, kind: definition.id, x, y });
}

export function trapActionCost(
  definitions: ReadonlyMap<string, TrapDefinition>,
  traps: readonly TrapState[],
  player: Pick<PlayerState, 'modifiers' | 'suppressedTicks'>,
  trapId: string,
  at: Vec2,
): number | null {
  const definition = definitions.get(trapId);
  return definition === undefined
    ? null
    : actionCost(definition, trapAt(definitions, traps, at), player);
}

function actionCost(
  definition: TrapDefinition,
  under: TrapState | undefined,
  player: Pick<PlayerState, 'modifiers' | 'suppressedTicks'>,
): number | null {
  if (under === undefined) {
    return statValue(player, 'trapCostMul', definition.cost);
  }
  if (under.kind !== definition.id || under.level >= definition.maxLevel) {
    return null;
  }
  return statValue(player, 'trapCostMul', definition.cost * (under.level + 1));
}

function trapAt(
  definitions: ReadonlyMap<string, TrapDefinition>,
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

function pay(state: SimState, cost: number): void {
  state.core.watts -= cost;
  state.stats.wattsSpent += cost;
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

export function fire(firing: Firing): void {
  const { state, at, effect, contact, by, power, damageMul, radiusMul, markedMul } = firing;
  switch (effect.kind) {
    case 'shockwave':
      shockwave(
        state,
        at,
        effect.radius * radiusMul,
        effect.damage * damageMul,
        effect.knockback,
        markedMul,
        by,
      );
      return;
    case 'beam':
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && inBeam(enemy, at, effect.length * radiusMul, effect.width / 2)) {
          hurtEnemy(state, enemy, effect.damagePerTick * damageMul, markedMul, by);
        }
      }
      return;
    case 'mist': {
      const radius = effect.radius * radiusMul;
      slowEnemies(state, at, radius, effect.slowFactor);
      healPlayersOnBar(state, at, radius, effect.healPerBar * power);
      return;
    }
    case 'lure':
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && touches(enemy, at, effect.radius * radiusMul)) {
          markEnemy(state, enemy, LURE_MARK_TICKS);
          drawTo(enemy, at, contact + enemy.radius);
        }
      }
      return;
    case 'strobe': {
      const stun = wholeTicks(effect.stunTicks * power);
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && touches(enemy, at, effect.radius * radiusMul)) {
          enemy.stunTicks = Math.max(enemy.stunTicks, stun);
        }
      }
      return;
    }
  }
}

function inBeam(enemy: EnemyState, trap: Emitter, length: number, halfWidth: number): boolean {
  const { direction } = trap;
  const dx = enemy.x - trap.x;
  const dy = enemy.y - trap.y;
  const along = dx * direction.x + dy * direction.y;
  const across = Math.abs(dx * direction.y - dy * direction.x);
  return (
    along >= -enemy.radius && along <= length + enemy.radius && across <= halfWidth + enemy.radius
  );
}

function takeHeavyBlows(state: SimState, content: ResolvedContent, trap: TrapState): void {
  if (trap.cooldown > 0) {
    trap.cooldown -= 1;
    if (trap.cooldown > 0) {
      return;
    }
  }
  const { radius } = trapDefinition(content, trap);
  let nextBlow = 0;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0 || enemy.stunTicks > 0 || !touches(enemy, trap, radius)) {
      continue;
    }
    const definition = lookup(content.enemies, enemy.kind, 'enemy');
    if (definition.behaviour !== 'heavy' && !enemy.isBoss) {
      continue;
    }
    trap.hp -= enemy.damage;
    nextBlow =
      nextBlow === 0
        ? definition.attackCooldownTicks
        : Math.min(nextBlow, definition.attackCooldownTicks);
  }
  trap.cooldown = nextBlow;
}

function removeBrokenTraps(state: SimState): void {
  keepWhere(state.traps, (trap) => {
    if (trap.hp > 0) {
      return true;
    }
    state.events.push({
      type: 'trapDestroyed',
      id: trap.id,
      kind: trap.kind,
      x: trap.x,
      y: trap.y,
    });
    return false;
  });
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
