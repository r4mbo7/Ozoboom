import type { TrapWear } from '../data/types';
import { clamp01 } from '../shared/scalar';
import { distanceSquared } from '../shared/vec';
import { lookup } from './lookup';
import type { CarriedTrap, PlayerId, PlayerState, SimState, TrapState } from './state';
import { statValue } from './stats';
import { keepWhere } from './effects';
import { liftNext, nearTrap } from './trap-moves';
import type { StepContext } from './systems/types';

// The share of its full effect a trap acts with, reach and strength alike: from 1 fresh down to the
// set's `faintest` just before it goes out; 1 on a set where traps do not wear.
export function trapPower(
  trap: Pick<CarriedTrap, 'intensity'>,
  wear: TrapWear | undefined,
): number {
  return wear === undefined ? 1 : wear.faintest + (1 - wear.faintest) * trap.intensity;
}

// Every trap wears, placed or carried, slower at each Volume level and with its owner's or carrier's
// Colliers de serrage; out, it leaves quietly.
export function wearTraps({ state, set, tempo }: StepContext): void {
  const rules = set.trapWear;
  if (rules === undefined) {
    return;
  }
  const wear = wearPerBar(rules, state) / tempo.ticksPerBar;
  let kept = 0;
  for (const trap of state.traps) {
    trap.intensity -= wear * wearMul(ownerOf(state, trap.ownerId));
    if (trap.intensity > 0) {
      state.traps[kept] = trap;
      kept += 1;
    } else {
      const { id, kind, x, y } = trap;
      state.events.push({ type: 'trapWornOut', id, kind, x, y });
    }
  }
  state.traps.length = kept;
  for (const player of state.players) {
    const carried = player.carriedTrap;
    if (carried === undefined) {
      continue;
    }
    const worn = wear * wearMul(player);
    const outs: CarriedTrap[] = [];
    for (const held of [carried, ...(player.carriedUnder ?? [])]) {
      held.intensity -= worn;
      if (held.intensity <= 0) {
        outs.push(held);
      }
    }
    for (const out of outs) {
      dropCarried(player, out);
      const { id, kind } = out;
      state.events.push({ type: 'carriedTrapWornOut', id, kind, playerId: player.id });
    }
  }
}

function dropCarried(player: PlayerState, out: CarriedTrap): void {
  if (player.carriedTrap === out) {
    liftNext(player);
  } else if (player.carriedUnder !== undefined) {
    keepWhere(player.carriedUnder, (held) => held !== out);
    if (player.carriedUnder.length === 0) {
      delete player.carriedUnder;
    }
  }
  if (player.carriedTrap === undefined) {
    delete player.laidTrapIds;
  }
}

// A player with the Rallonge plugs into one worn placed trap at a time, the nearest in reach, once every
// `rechargeEveryBars` per trap at most. Over the plugged beat it gets back the wear of a few bars,
// always fewer bars than that, so it lasts longer but still goes out. Walking away does not unplug;
// the plug ends early when the trap leaves the ground or the player goes down.
export function rechargeTraps(ctx: StepContext): void {
  const rules = ctx.set.trapWear;
  if (rules === undefined) {
    return;
  }
  for (const player of ctx.state.players) {
    if (player.rechargePlug !== undefined) {
      holdPlug(ctx, rules, player, player.rechargePlug);
    }
    if (player.rechargePlug === undefined && !player.downed) {
      startPlug(ctx, rules, player);
    }
  }
}

function holdPlug(
  { state, tempo }: StepContext,
  rules: TrapWear,
  player: PlayerState,
  plug: NonNullable<PlayerState['rechargePlug']>,
): void {
  const trap = state.traps.find((candidate) => candidate.id === plug.trapId);
  if (trap === undefined || player.downed) {
    delete player.rechargePlug;
    return;
  }
  const beats = (state.tick - plug.tick) / tempo.ticksPerBeat;
  const given = pluggedShare(rules, beats) - pluggedShare(rules, beats - 1 / tempo.ticksPerBeat);
  const notch = statValue(player, 'trapRechargeBarsAdd', 0) * wearPerBar(rules, state);
  trap.intensity = Math.min(1, trap.intensity + notch * given);
  if (beats >= rules.plugInBeats + rules.pluggedBeats + rules.unplugBeats) {
    delete player.rechargePlug;
  }
}

// The share of the plugged beat gone by: the steps add up to the whole notch, whatever the tempo.
function pluggedShare(rules: TrapWear, beats: number): number {
  return clamp01((beats - rules.plugInBeats) / rules.pluggedBeats);
}

function startPlug(
  { state, content, tempo }: StepContext,
  rules: TrapWear,
  player: PlayerState,
): void {
  const bars = statValue(player, 'trapRechargeBarsAdd', 0);
  if (bars <= 0) {
    return;
  }
  // A trap worn by less than the notch would waste it, and its cooldown: a fresh one is left alone.
  const fullest = 1 - bars * wearPerBar(rules, state);
  const cooldown = rules.rechargeEveryBars * tempo.ticksPerBar;
  let nearest: TrapState | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const trap of state.traps) {
    const last = trap.rechargedTick;
    if (trap.intensity > fullest || (last !== undefined && state.tick - last < cooldown)) {
      continue;
    }
    const { radius } = lookup(content.traps, trap.kind, 'trap');
    const distance = distanceSquared(trap, player);
    if (distance < nearestDistance && nearTrap(player, trap, radius, 1)) {
      nearest = trap;
      nearestDistance = distance;
    }
  }
  if (nearest !== undefined) {
    nearest.rechargedTick = state.tick;
    player.rechargePlug = { trapId: nearest.id, tick: state.tick };
    const { id, kind, x, y } = nearest;
    state.events.push({ type: 'trapRecharged', id, kind, playerId: player.id, x, y });
  }
}

// At Volume 0, the inverse of its lifetime; a share less at each Volume level.
function wearPerBar(rules: TrapWear, state: Pick<SimState, 'volume'>): number {
  return 1 / (rules.lifetimeBars * (1 + rules.lifetimePerVolume * (state.volume ?? 0)));
}

function ownerOf(state: Pick<SimState, 'players'>, id: PlayerId): PlayerState | undefined {
  return state.players.find((player) => player.id === id);
}

function wearMul(player: PlayerState | undefined): number {
  return player === undefined ? 1 : statValue(player, 'trapWearMul', 1);
}
