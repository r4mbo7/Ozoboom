import type { SetDefinition, TrapDefinition } from '../data/types';
import { distanceSquared, normalize } from '../shared/vec';
import type { ResolvedContent } from './content';
import { lookup } from './lookup';
import type { CarriedTrap, PlayerId, PlayerState, SimState, TrapState, Vec2 } from './state';
import { statValue } from './stats';
import { shoreOf, wet } from './shore';
import type { StepContext } from './systems/types';

// How far past the two bodies' edges the place key reaches a trap, the Banane further, and a
// Rallonge recharges one walked by.
const TRAP_REACH = 24;
// A trap put down stands this far past the player's edge, along the aim: still within reach.
const PUT_GAP = 6;
const EIGHTH_TURN = Math.SQRT1_2;

export function moveTrap(ctx: StepContext, player: PlayerState): void {
  if (player.downed) {
    return;
  }
  const { state, content } = ctx;
  const lifted = trapTheKeyTakes(content.traps, state.traps, player, trapCapacity(content, player));
  if (lifted !== undefined) {
    state.traps.splice(state.traps.indexOf(lifted), 1);
    const { id, kind, intensity, rechargedTick, awaitsCord } = lifted;
    carryOnTop(player, {
      id,
      kind,
      intensity,
      ...(rechargedTick !== undefined && { rechargedTick }),
      ...(awaitsCord !== undefined && { awaitsCord }),
    });
    const { x, y } = lifted;
    state.events.push({ type: 'trapTaken', id, kind, playerId: player.id, x, y });
    return;
  }
  const carried = player.carriedTrap;
  if (carried === undefined) {
    return;
  }
  const { radius } = lookup(content.traps, carried.kind, 'trap');
  const aim = normalize(player.aim);
  const gap = player.radius + radius + PUT_GAP;
  putDown(ctx, player, { x: player.x + aim.x * gap, y: player.y + aim.y * gap }, aim);
}

// The trap the place key takes: in reach, while there is room above the head, never one this
// player laid while still carrying another.
export function trapTheKeyTakes(
  definitions: ReadonlyMap<string, Pick<TrapDefinition, 'radius'>>,
  traps: readonly TrapState[],
  player: Pick<
    PlayerState,
    | 'x'
    | 'y'
    | 'radius'
    | 'aim'
    | 'carriedTrap'
    | 'carriedUnder'
    | 'laidTrapIds'
    | 'modifiers'
    | 'suppressedTicks'
    | 'boosts'
  >,
  capacity: number,
): TrapState | undefined {
  if (!hasTrapRoom(player, capacity)) {
    return undefined;
  }
  const laid = player.laidTrapIds;
  const free =
    laid === undefined ? traps : traps.filter((candidate) => !laid.includes(candidate.id));
  return trapInReach(definitions, free, player);
}

function carriedCount(player: Pick<PlayerState, 'carriedTrap' | 'carriedUnder'>): number {
  return player.carriedTrap === undefined ? 0 : 1 + (player.carriedUnder?.length ?? 0);
}

// The traps a player carries, the top one first.
export function carriedTraps(
  player: Pick<PlayerState, 'carriedTrap' | 'carriedUnder'>,
): CarriedTrap[] {
  return player.carriedTrap === undefined
    ? []
    : [player.carriedTrap, ...(player.carriedUnder ?? [])];
}

// How many traps the player's class carries above the head: `ClassDefinition.carriedTraps`, absent
// meaning one.
export function trapCapacity(
  content: Pick<ResolvedContent, 'classes'>,
  player: Pick<PlayerState, 'classId'>,
): number {
  return lookup(content.classes, player.classId, 'class').carriedTraps ?? 1;
}

// Room above the head for one more trap.
export function hasTrapRoom(
  player: Pick<PlayerState, 'carriedTrap' | 'carriedUnder'>,
  capacity: number,
): boolean {
  return carriedCount(player) < capacity;
}

// On top of any carried trap, the one below kept for later: `liftNext` undoes it.
function carryOnTop(player: PlayerState, trap: CarriedTrap): void {
  if (player.carriedTrap !== undefined) {
    (player.carriedUnder ??= []).push(player.carriedTrap);
  }
  player.carriedTrap = trap;
}

// A new trap straight above the head: it rises from the player.
export function giveTrap(ctx: StepContext, player: PlayerState, kind: string): void {
  const { state } = ctx;
  const id = state.nextEntityId;
  state.nextEntityId += 1;
  carryOnTop(player, { id, kind, intensity: 1 });
  state.events.push({ type: 'trapTaken', id, kind, playerId: player.id, x: player.x, y: player.y });
}

// The carried trap goes down at `at`, or the nearest spot that takes it, in the player's name; the
// one under it comes up.
function putDown(ctx: StepContext, player: PlayerState, at: Vec2, direction: Vec2): void {
  const carried = player.carriedTrap;
  if (carried === undefined) {
    return;
  }
  const spot = stand(ctx, carried, player.id, at, direction);
  if (spot === undefined) {
    return;
  }
  liftNext(player);
  if (player.carriedTrap === undefined) {
    delete player.laidTrapIds;
  } else {
    (player.laidTrapIds ??= []).push(spot.id);
  }
  const { id, kind, x, y } = spot;
  ctx.state.events.push({ type: 'trapPlaced', id, kind, playerId: player.id, x, y });
}

// Every carried trap goes down around `at`, the top one first, while a spot takes it. Returns
// whether the player's hands are free.
export function putAllDown(
  ctx: StepContext,
  player: PlayerState,
  at: Vec2,
  direction: Vec2,
): boolean {
  for (let top = player.carriedTrap; top !== undefined; top = player.carriedTrap) {
    putDown(ctx, player, at, direction);
    if (player.carriedTrap === top) {
      return false;
    }
  }
  return true;
}

// The top carried trap is gone: the one under it comes up.
export function liftNext(player: PlayerState): void {
  const next = player.carriedUnder?.pop();
  if (next === undefined) {
    delete player.carriedTrap;
  } else {
    player.carriedTrap = next;
  }
  if (player.carriedUnder?.length === 0) {
    delete player.carriedUnder;
  }
}

// A dying carrier's trap, already placed, facing away from the stage.
export function dropTrap(ctx: StepContext, kind: string, ownerId: PlayerId, at: Vec2): void {
  const trap = { id: ctx.state.nextEntityId, kind, intensity: 1 };
  ctx.state.nextEntityId += 1;
  const placed = stand(ctx, trap, ownerId, at, outward(ctx.state, at));
  if (placed !== undefined) {
    const { id, x, y } = placed;
    ctx.state.events.push({ type: 'trapDropped', id, kind, x, y });
  }
}

// Each player's starting trap, in front of them on the side away from the stage.
export function placeStartingTraps(ctx: StepContext): void {
  const kind = ctx.set.startingTrap;
  if (kind === undefined) {
    return;
  }
  const { radius } = lookup(ctx.content.traps, kind, 'trap');
  for (const player of ctx.state.players) {
    const away = outward(ctx.state, player);
    const gap = player.radius + radius + PUT_GAP;
    const at = { x: player.x + away.x * gap, y: player.y + away.y * gap };
    stand(ctx, { id: ctx.state.nextEntityId, kind, intensity: 1 }, player.id, at, away);
    ctx.state.nextEntityId += 1;
  }
}

function stand(
  { state, content, set }: StepContext,
  trap: CarriedTrap,
  ownerId: PlayerId,
  at: Vec2,
  direction: Vec2,
): TrapState | undefined {
  const { radius } = lookup(content.traps, trap.kind, 'trap');
  const spot = trapSpot(
    state,
    set,
    { ...at, radius },
    (other) => lookup(content.traps, other.kind, 'trap').radius,
  );
  if (spot === undefined) {
    return undefined;
  }
  const placed: TrapState = {
    ...trap,
    ownerId,
    x: spot.x,
    y: spot.y,
    prevX: spot.x,
    prevY: spot.y,
    direction,
  };
  state.traps.push(placed);
  return placed;
}

function outward(state: SimState, from: Vec2): Vec2 {
  const away = normalize({ x: from.x - state.core.x, y: from.y - state.core.y });
  return away.x === 0 && away.y === 0 ? { x: 1, y: 0 } : away;
}

// The spot itself if it takes the trap, else the nearest of rings of eight around it.
export function trapSpot(
  state: Pick<SimState, 'arena' | 'core' | 'traps' | 'seed'>,
  set: Pick<SetDefinition, 'obstacles' | 'lake' | 'arena'>,
  footprint: { x: number; y: number; radius: number },
  radiusOf: (trap: TrapState) => number,
): Vec2 | undefined {
  const shore = shoreOf(set, state.seed);
  const fits = (spot: Vec2): boolean =>
    trapFits(state, set, { ...spot, radius: footprint.radius }, radiusOf) &&
    !wet(shore, spot, footprint.radius);
  if (fits(footprint)) {
    return { x: footprint.x, y: footprint.y };
  }
  const step = footprint.radius;
  const rings = Math.ceil((state.arena.width + state.arena.height) / step);
  for (let ring = 1; ring <= rings; ring++) {
    let side = { x: 1, y: 0 };
    for (let turn = 0; turn < 8; turn++) {
      const spot = { x: footprint.x + side.x * ring * step, y: footprint.y + side.y * ring * step };
      if (fits(spot)) {
        return spot;
      }
      side = { x: (side.x - side.y) * EIGHTH_TURN, y: (side.x + side.y) * EIGHTH_TURN };
    }
  }
  return undefined;
}

// The trap the place key lifts: the nearest to the spot in front of the player, within reach, which
// the Banane stretches.
export function trapInReach(
  definitions: ReadonlyMap<string, Pick<TrapDefinition, 'radius'>>,
  traps: readonly TrapState[],
  player: Pick<
    PlayerState,
    'x' | 'y' | 'radius' | 'aim' | 'modifiers' | 'suppressedTicks' | 'boosts'
  >,
): TrapState | undefined {
  const aim = normalize(player.aim);
  const front = { x: player.x + aim.x * player.radius, y: player.y + aim.y * player.radius };
  const stretch = statValue(player, 'liftReachMul', 1);
  let best: TrapState | undefined;
  let bestDistance = Infinity;
  for (const trap of traps) {
    const fromFront = distanceSquared(trap, front);
    const { radius } = lookup(definitions, trap.kind, 'trap');
    if (fromFront < bestDistance && nearTrap(player, trap, radius, stretch)) {
      best = trap;
      bestDistance = fromFront;
    }
  }
  return best;
}

// Whether a trap stands within the player's reach, `stretch` times the base one past the edges.
export function nearTrap(
  player: Pick<PlayerState, 'x' | 'y' | 'radius'>,
  trap: Vec2,
  trapRadius: number,
  stretch: number,
): boolean {
  const reach = player.radius + trapRadius + TRAP_REACH * stretch;
  return distanceSquared(trap, player) <= reach * reach;
}

// Where a trap may stand: inside the arena, off the core, the obstacles and the other traps.
function trapFits(
  state: Pick<SimState, 'arena' | 'core' | 'traps'>,
  set: Pick<SetDefinition, 'obstacles'>,
  footprint: { x: number; y: number; radius: number },
  radiusOf: (trap: TrapState) => number,
): boolean {
  const { x, y, radius } = footprint;
  const { arena, core } = state;
  return (
    x >= radius &&
    x <= arena.width - radius &&
    y >= radius &&
    y <= arena.height - radius &&
    !overlaps(footprint, core, core.radius) &&
    !(set.obstacles ?? []).some((obstacle) => overlaps(footprint, obstacle, obstacle.radius)) &&
    !state.traps.some((trap) => overlaps(footprint, trap, radiusOf(trap)))
  );
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
