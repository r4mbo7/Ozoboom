import type { SetDefinition, TrapWear } from '../../data/types';
import { isBarTick, isBeatTick } from '../../shared/tempo';
import { distanceSquared } from '../../shared/vec';
import { touches } from '../effects';
import type { BatteryPlug, BatteryState, EntityId, PlayerState, SimState } from '../state';
import { carriedTraps } from '../trap-moves';
import { cordTicks } from '../trap-wear';
import { freeCarrier, inDrawnPhrase, saltedPhrase, type DrawnPhrase } from './stage-bonus';
import type { StepContext } from './types';

type Charging = Extract<BatteryState, { stage: 'charging' }>;
type Lying = Extract<BatteryState, { stage: 'lying' }>;
// All the Batterie reads of a step: the render's fixtures run it too.
type BatteryContext = Pick<StepContext, 'state' | 'set' | 'tempo'>;

const BATTERY_TAG = 0x42415454;

export function batteryPhrase(
  seed: number,
  stageStartTick: number,
  set: SetDefinition,
): DrawnPhrase | null {
  const rules = set.battery;
  return rules === undefined
    ? null
    : saltedPhrase(BATTERY_TAG, rules.chance, seed, stageStartTick, set);
}

// A bomb or twin vibes due go first, and no two bonuses ride the same bad vibe.
export function batteryCarriers({ state, set, tempo }: StepContext): void {
  // Where traps never wear it would renew nothing: no bad vibe carries it.
  if (set.battery === undefined || set.trapWear === undefined) {
    return;
  }
  if (
    state.battery === undefined &&
    isBarTick(state.tick, tempo) &&
    inDrawnPhrase(state, set, tempo, batteryPhrase)
  ) {
    state.battery = { stage: 'due' };
  }
  if (
    state.battery?.stage !== 'due' ||
    state.bombDue === true ||
    state.twinVibes?.stage === 'due'
  ) {
    return;
  }
  const carrier = freeCarrier(state);
  if (carrier !== undefined) {
    carrier.carriesBattery = true;
    state.battery = { stage: 'carried' };
  }
}

export function dropBattery({ state, set }: StepContext, x: number, y: number): void {
  const rules = set.battery;
  if (rules === undefined) {
    return;
  }
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  state.battery = { stage: 'lying', id, x, y };
  state.events.push({ type: 'batteryDropped', id, x, y });
}

// Its cords follow the Rallonge's plug timings; the sweep goes on if the taker goes down or leaves.
export function battery(ctx: BatteryContext): void {
  const { state, set } = ctx;
  const rules = set.battery;
  const wear = set.trapWear;
  const cell = state.battery;
  if (rules === undefined || wear === undefined || cell === undefined) {
    return;
  }
  if (cell.stage === 'charging') {
    sweep(ctx, wear, cell);
    return;
  }
  if (cell.stage !== 'lying') {
    return;
  }
  const taker = state.players.find(
    (player) => !player.downed && player.gone !== true && touches(player, cell, rules.radius),
  );
  if (taker !== undefined) {
    take(ctx, wear, cell, taker);
  }
}

// Carried traps are renewed at once; placed ones wait their cord, nearest the taker first, without wearing.
function take(ctx: BatteryContext, wear: TrapWear, lying: Lying, taker: PlayerState): void {
  const { state } = ctx;
  for (const player of state.players) {
    for (const held of carriedTraps(player)) {
      held.intensity = 1;
    }
  }
  for (const trap of state.traps) {
    trap.awaitsCord = true;
  }
  const queue = [...state.traps]
    .sort((a, b) => distanceSquared(a, taker) - distanceSquared(b, taker))
    .map(({ id }) => id);
  const { id, x, y } = lying;
  const charging: Charging = { stage: 'charging', playerId: taker.id, x, y, queue, plugs: [] };
  state.battery = charging;
  state.events.push({ type: 'batteryTaken', id, playerId: taker.id, x, y });
  sweep(ctx, wear, charging);
}

// A cord on each beat from the take; once the last landed, all stay plugged a while, then let go together.
function sweep({ state, tempo }: BatteryContext, wear: TrapWear, charging: Charging): void {
  if (isBeatTick(state.tick, tempo)) {
    throwCord(state, charging);
  }
  const { flight, plugged, unplug } = cordTicks(wear, tempo);
  const landing = thrownAt(charging, state.tick - flight);
  if (landing !== undefined) {
    renew(state, landing.trapId);
  }
  const thrown = charging.plugs.at(-1);
  if (thrown === undefined) {
    if (charging.queue.length === 0) {
      state.battery = { stage: 'over' };
    }
    return;
  }
  const landed = thrown.tick + flight;
  if (charging.queue.length === 0 && charging.letGoTick === undefined && state.tick >= landed) {
    charging.letGoTick = landed + plugged;
  }
  if (charging.letGoTick !== undefined && state.tick >= charging.letGoTick + unplug) {
    state.battery = { stage: 'over' };
  }
}

// The cord thrown at `tick`, if any: they leave in order, so the search stops at the first one older.
function thrownAt(charging: Charging, tick: number): BatteryPlug | undefined {
  const { plugs } = charging;
  for (let index = plugs.length - 1; index >= 0; index -= 1) {
    const plug = plugs[index];
    if (plug === undefined || plug.tick < tick) {
      return undefined;
    }
    if (plug.tick === tick) {
      return plug;
    }
  }
  return undefined;
}

// To the next queued trap still placed: one gone costs no beat, one carried is renewed at once, without a cord.
function throwCord(state: SimState, charging: Charging): void {
  for (let trapId = charging.queue.shift(); trapId !== undefined; trapId = charging.queue.shift()) {
    const placed = state.traps.find(({ id }) => id === trapId);
    if (placed === undefined) {
      renew(state, trapId);
      continue;
    }
    const { kind, x, y } = placed;
    const index = charging.plugs.length;
    charging.plugs.push({ trapId, tick: state.tick });
    state.events.push({
      type: 'batteryPlugged',
      trapId,
      kind,
      playerId: charging.playerId,
      index,
      x,
      y,
    });
    return;
  }
}

// Wherever the trap is now, placed or carried; nothing if it is gone.
function renew(state: SimState, trapId: EntityId): void {
  const trap =
    state.traps.find(({ id }) => id === trapId) ??
    state.players.flatMap(carriedTraps).find(({ id }) => id === trapId);
  if (trap !== undefined) {
    trap.intensity = 1;
    delete trap.awaitsCord;
  }
}

// The stage's Batterie goes with it, and no trap carried on keeps waiting for a cord.
export function clearBattery(state: SimState): void {
  delete state.battery;
  for (const player of state.players) {
    for (const held of carriedTraps(player)) {
      delete held.awaitsCord;
    }
  }
}
