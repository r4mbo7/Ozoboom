import type { ZoneCadence, ZoneDefinition } from '../data/types';
import { isBeatTick, isOffbeatTick, type Tempo } from '../shared/tempo';
import { normalize, type Vec2 } from '../shared/vec';
import {
  drawTo,
  healPlayer,
  hurtEnemy,
  keepWhere,
  knockBack,
  markedDamageMul,
  touches,
} from './effects';
import type { PlayerState, SimState, ZoneState } from './state';
import type { StepContext } from './systems/types';

export interface ZonePlacement {
  x: number;
  y: number;
  // The way a line zone lies. Absent, the aim of the player who lays it.
  direction?: Vec2;
  // Multiplies its damage and its heal. Absent means 1.
  power?: number;
  // Absent, the radius of its definition.
  radius?: number;
}

export function layZone(
  { state, tempo }: Pick<StepContext, 'state' | 'tempo'>,
  player: PlayerState,
  definition: ZoneDefinition,
  placement: ZonePlacement,
): ZoneState {
  const laid = (state.zones ??= []);
  makeRoom(state, laid, player, definition);
  const along = normalize(placement.direction ?? player.aim);
  const zone: ZoneState = {
    id: state.nextEntityId++,
    playerId: player.id,
    definition,
    x: placement.x,
    y: placement.y,
    direction: along.x === 0 && along.y === 0 ? { x: 1, y: 0 } : along,
    power: placement.power ?? 1,
    radius: placement.radius ?? definition.radius,
    ticksLeft: definition.durationBars * tempo.ticksPerBar,
  };
  laid.push(zone);
  state.events.push({
    type: 'zoneLaid',
    id: zone.id,
    zoneId: definition.id,
    playerId: player.id,
    x: zone.x,
    y: zone.y,
  });
  return zone;
}

// After `traps`, which resets the slow of the bad vibes: this slow rules their next step. The pull
// replaces the step they just took, as a lure does.
export function zones({ state, content, tempo }: StepContext): void {
  const laid = state.zones;
  if (laid === undefined) {
    return;
  }
  const markedMul = markedDamageMul(content);
  for (const zone of laid) {
    const { definition, power, playerId } = zone;
    const strikes = strikesOn(definition.cadence, state.tick, tempo);
    zone.ticksLeft -= 1;
    const closing = zone.ticksLeft <= 0 && definition.closeDamage !== undefined;
    for (const enemy of state.enemies) {
      const at = nearestOnAxis(zone, enemy);
      if (enemy.hp <= 0 || !touches(enemy, at, zone.radius)) {
        continue;
      }
      if (definition.slowFactor !== undefined) {
        enemy.slowFactor = Math.min(enemy.slowFactor, definition.slowFactor);
      }
      if (definition.pull === true) {
        drawTo(enemy, zone, enemy.radius);
      }
      if (strikes && definition.damage !== undefined) {
        hurtEnemy(state, enemy, definition.damage * power, markedMul, playerId, at);
      }
      if (strikes && definition.knockback !== undefined) {
        knockBack(enemy, at, definition.knockback);
      }
      if (closing) {
        hurtEnemy(state, enemy, (definition.closeDamage ?? 0) * power, markedMul, playerId, at);
      }
    }
    if (strikes && definition.heal !== undefined) {
      for (const player of state.players) {
        if (!player.downed && touches(player, nearestOnAxis(zone, player), zone.radius)) {
          healPlayer(state, player, definition.heal * power);
        }
      }
    }
  }
  keepWhere(laid, (zone) => zone.ticksLeft > 0 || goOut(state, zone));
  if (laid.length === 0) {
    delete state.zones;
  }
}

function strikesOn(cadence: ZoneCadence, tick: number, tempo: Tempo): boolean {
  switch (cadence) {
    case 'beat':
      return isBeatTick(tick, tempo);
    case 'offbeat':
      return isOffbeatTick(tick, tempo);
    case 'continuous':
      return true;
  }
}

function makeRoom(
  state: SimState,
  laid: ZoneState[],
  player: PlayerState,
  definition: ZoneDefinition,
): void {
  const isMine = (zone: ZoneState) =>
    zone.playerId === player.id && zone.definition.id === definition.id;
  let mine = laid.filter(isMine).length;
  keepWhere(laid, (zone) => {
    if (mine < definition.maxPerPlayer || !isMine(zone)) {
      return true;
    }
    mine -= 1;
    return goOut(state, zone);
  });
}

function goOut(state: SimState, zone: ZoneState): false {
  const { id, x, y } = zone;
  state.events.push({ type: 'zoneEnded', id, zoneId: zone.definition.id, x, y });
  return false;
}

// The centre of a disc; on a line, the point of its axis closest to `body`.
function nearestOnAxis(zone: ZoneState, body: Vec2): Vec2 {
  const halfLength = (zone.definition.length ?? 0) / 2;
  if (halfLength === 0) {
    return zone;
  }
  const { direction } = zone;
  const along = (body.x - zone.x) * direction.x + (body.y - zone.y) * direction.y;
  const clamped = Math.min(halfLength, Math.max(-halfLength, along));
  return { x: zone.x + direction.x * clamped, y: zone.y + direction.y * clamped };
}
