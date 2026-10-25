import { isBarTick } from '../../shared/tempo';
import { lookup } from '../content';
import { healPlayer, touches } from '../effects';
import { applyModifiers, refreshDerivedStats } from '../stats';
import type { PlayerState, WeaponSlot } from '../state';
import type { WeaponModule } from './types';

const point = { x: 0, y: 0 };
const NONE: readonly number[] = [];

export const trail: WeaponModule = {
  fire({ state, content, tempo }, player, slot, { effect }, { power }) {
    if (effect.kind !== 'trail') {
      return;
    }
    if (slot.trail === undefined) {
      slot.trail = new Array<number>(effect.lengthTicks * 2).fill(0);
      applyModifiers(player, [{ stat: 'speedMul', mul: effect.speedMul }]);
      refreshDerivedStats(player, lookup(content.classes, player.classId, 'class'));
    }
    const ring = slot.trail;
    const write = (state.tick % effect.lengthTicks) * 2;
    ring[write] = player.x;
    ring[write + 1] = player.y;
    slot.phase = Math.min(slot.phase + 1, effect.lengthTicks);
    const dashes = dashTrail(slot, player, effect.dashTrailTicks, state.tick);
    const on = (body: { x: number; y: number; radius: number }) =>
      onTrail(body, ring, state.tick, slot.phase, player.radius) ||
      onDashTrail(body, dashes, player.radius);

    for (const enemy of state.enemies) {
      if (enemy.hp > 0 && on(enemy)) {
        enemy.slowFactor = Math.min(enemy.slowFactor, effect.slowFactor);
      }
    }
    if (isBarTick(state.tick, tempo)) {
      for (const ally of state.players) {
        if (!ally.downed && on(ally)) {
          healPlayer(state, ally, effect.healPerBar * power);
        }
      }
    }
  },
};

// The ring is written at `tick % length`: read back the `filled` most recent samples by age.
function onTrail(
  body: { x: number; y: number; radius: number },
  ring: readonly number[],
  tick: number,
  filled: number,
  width: number,
): boolean {
  const length = ring.length / 2;
  for (let age = 0; age < filled; age++) {
    const at = (((tick - age) % length) + length) % length;
    point.x = ring[at * 2] ?? 0;
    point.y = ring[at * 2 + 1] ?? 0;
    if (touches(body, point, width)) {
      return true;
    }
  }
  return false;
}

function dashTrail(
  slot: WeaponSlot,
  player: PlayerState,
  ticks: number | undefined,
  tick: number,
): readonly number[] {
  if (ticks === undefined) {
    return NONE;
  }
  const kept = slot.dashTrail ?? [];
  let fresh = 0;
  while (fresh < kept.length && (kept[fresh + 2] ?? 0) <= tick) {
    fresh += 3;
  }
  kept.splice(0, fresh);
  if (player.dash !== undefined) {
    kept.push(player.x, player.y, tick + ticks);
  }
  if (kept.length === 0) {
    delete slot.dashTrail;
    return NONE;
  }
  slot.dashTrail = kept;
  return kept;
}

function onDashTrail(
  body: { x: number; y: number; radius: number },
  points: readonly number[],
  width: number,
): boolean {
  for (let index = 0; index < points.length; index += 3) {
    point.x = points[index] ?? 0;
    point.y = points[index + 1] ?? 0;
    if (touches(body, point, width)) {
      return true;
    }
  }
  return false;
}
