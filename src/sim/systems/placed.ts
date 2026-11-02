import type { WeaponDefinition } from '../../data/types';
import { isBarTick } from '../../shared/tempo';
import { lookup } from '../content';
import {
  compound,
  drawTo,
  healPlayersOnBar,
  keepWhere,
  shockwave,
  slowEnemies,
  touches,
} from '../effects';
import type { PlacedState, SimState } from '../state';
import type { StepContext } from './types';

const TOTEM_BODY_RADIUS = 14;

// Before the steering, so the slow of this tick is the one the enemies move with.
export function placedZones(ctx: StepContext): void {
  const { state } = ctx;
  const { placed } = state;
  if (placed === undefined || placed.length === 0) {
    return;
  }
  let built = false;
  for (const zone of placed) {
    const { effect } = definitionOf(ctx, zone);
    const power = powerOf(ctx, zone);
    if (effect.kind === 'plate') {
      if (!built) {
        ctx.enemyGrid.rebuild(state.enemies);
        built = true;
      }
      slowEnemies(state, ctx.enemyGrid, zone, zone.radius, effect.slowFactor);
      healPlayersOnBar(state, ctx.tempo, zone, zone.radius, effect.healPerBar * power);
    }
    zone.ticksLeft -= 1;
  }
  removeExpired(state);
}

// After the steering: the totem replaces the step the enemies just took, as a lure does. Its draw
// moves the bad vibes every tick, so it reads them in a loop: the grid is only worth rebuilding
// for the wave on the bar.
export function placedTotems(ctx: StepContext): void {
  const { state } = ctx;
  for (const zone of state.placed ?? []) {
    const { effect } = definitionOf(ctx, zone);
    if (effect.kind !== 'totem') {
      continue;
    }
    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && touches(enemy, zone, zone.radius)) {
        drawTo(enemy, zone, TOTEM_BODY_RADIUS + enemy.radius, ctx.enemyObstacles);
      }
    }
    if (isBarTick(state.tick, ctx.tempo)) {
      ctx.enemyGrid.rebuild(state.enemies);
      shockwave(
        state,
        ctx.enemyGrid,
        zone,
        zone.radius,
        effect.damage * powerOf(ctx, zone),
        effect.knockback,
        zone.playerId,
        ctx.enemyObstacles,
      );
    }
  }
}

function definitionOf({ content }: StepContext, zone: PlacedState): WeaponDefinition {
  return lookup(content.weapons, zone.weaponId, 'weapon');
}

function powerOf({ state, content }: StepContext, zone: PlacedState): number {
  const owner = state.players.find((player) => player.id === zone.playerId);
  const slot = owner?.weapons?.find((candidate) => candidate.id === zone.weaponId);
  const definition = content.weapons.get(zone.weaponId);
  return slot === undefined || definition === undefined
    ? 1
    : compound(definition.levelMul, slot.level - 1);
}

function removeExpired(state: SimState): void {
  if (state.placed === undefined) {
    return;
  }
  keepWhere(state.placed, (zone) => {
    if (zone.ticksLeft > 0) {
      return true;
    }
    state.events.push({
      type: 'placedRemoved',
      id: zone.id,
      weaponId: zone.weaponId,
      x: zone.x,
      y: zone.y,
    });
    return false;
  });
}
