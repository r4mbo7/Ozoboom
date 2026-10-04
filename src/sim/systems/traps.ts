import type { TrapCadence, TrapDefinition } from '../../data/types';
import { isBarTick } from '../../shared/tempo';
import { normalize } from '../../shared/vec';
import type { PlayerAction } from '../commands';
import { lookup, type ResolvedContent } from '../content';
import {
  compound,
  hurtEnemy,
  keepWhere,
  markedDamageMul,
  pushAway,
  touches,
  wholeTicks,
} from '../effects';
import type { EnemyState, PlayerState, SimState, TrapState, Vec2 } from '../state';
import { statValue } from '../stats';
import type { StepContext } from './types';

type PlaceTrap = Extract<PlayerAction, { type: 'placeTrap' }>;

interface Firing {
  state: SimState;
  trap: TrapState;
  definition: TrapDefinition;
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
        fire({
          state,
          trap,
          definition,
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
  const cost = statValue(player, 'trapCostMul', definition.cost);
  if (state.core.watts < cost) {
    return;
  }

  const { x, y } = action;
  const under = state.traps.find((trap) =>
    touches({ x, y, radius: 0 }, trap, trapDefinition(content, trap).radius),
  );
  if (under !== undefined) {
    if (under.kind === definition.id && under.level < definition.maxLevel) {
      under.level += 1;
      pay(state, cost);
      const { id, kind, level } = under;
      state.events.push({ type: 'trapUpgraded', id, kind, level, x: under.x, y: under.y });
    }
    return;
  }

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
    state.traps.length < set.maxTraps;
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

function fire(firing: Firing): void {
  const { state, trap, definition, power, damageMul, radiusMul, markedMul } = firing;
  const { effect } = definition;
  state.events.push({ type: 'trapFired', id: trap.id, kind: trap.kind, x: trap.x, y: trap.y });
  switch (effect.kind) {
    case 'shockwave':
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && touches(enemy, trap, effect.radius * radiusMul)) {
          hurtEnemy(state, enemy, effect.damage * damageMul, markedMul, trap.ownerId);
          pushAway(enemy, trap, effect.knockback);
        }
      }
      return;
    case 'beam':
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && inBeam(enemy, trap, effect.length * radiusMul, effect.width / 2)) {
          hurtEnemy(state, enemy, effect.damagePerTick * damageMul, markedMul, trap.ownerId);
        }
      }
      return;
    case 'mist': {
      const radius = effect.radius * radiusMul;
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && touches(enemy, trap, radius)) {
          enemy.slowFactor = Math.min(enemy.slowFactor, effect.slowFactor);
        }
      }
      if (isBarTick(state.tick)) {
        for (const player of state.players) {
          if (!player.downed && touches(player, trap, radius)) {
            player.hp = Math.min(player.maxHp, player.hp + effect.healPerBar * power);
          }
        }
      }
      return;
    }
    case 'lure':
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && touches(enemy, trap, effect.radius * radiusMul)) {
          enemy.marked = true;
          drawTo(enemy, trap, definition.radius + enemy.radius);
        }
      }
      return;
    case 'strobe': {
      const stun = wholeTicks(effect.stunTicks * power);
      for (const enemy of state.enemies) {
        if (enemy.hp > 0 && touches(enemy, trap, effect.radius * radiusMul)) {
          enemy.stunTicks = Math.max(enemy.stunTicks, stun);
        }
      }
      return;
    }
  }
}

function inBeam(enemy: EnemyState, trap: TrapState, length: number, halfWidth: number): boolean {
  const { direction } = trap;
  const dx = enemy.x - trap.x;
  const dy = enemy.y - trap.y;
  const along = dx * direction.x + dy * direction.y;
  const across = Math.abs(dx * direction.y - dy * direction.x);
  return (
    along >= -enemy.radius && along <= length + enemy.radius && across <= halfWidth + enemy.radius
  );
}

// The lure replaces the step the steering just gave the enemy: same speed, slow and stun, new goal.
function drawTo(enemy: EnemyState, trap: TrapState, contact: number): void {
  const step = enemy.stunTicks > 0 ? 0 : enemy.speed * enemy.slowFactor;
  const dx = trap.x - enemy.prevX;
  const dy = trap.y - enemy.prevY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const travel = Math.max(0, Math.min(step, distance - contact));
  enemy.x = distance === 0 ? enemy.prevX : enemy.prevX + (dx / distance) * travel;
  enemy.y = distance === 0 ? enemy.prevY : enemy.prevY + (dy / distance) * travel;
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
