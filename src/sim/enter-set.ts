import type { SetDefinition } from '../data/types';
import type { ResolvedContent } from './content';
import { createFlowFields } from './flow-field';
import { createCore, createSpeakers } from './initial-state';
import { setTempo } from './lineup';
import { SpatialHash } from './spatial-hash';
import type { PlayerState, SimEvent, SimState, Vec2 } from './state';
import { tempo } from './systems/tempo';
import type { StepContext } from './systems/types';

const ENEMY_GRID_CELL_SIZE = 64;

export function setBindings(
  set: SetDefinition,
  content: ResolvedContent,
  startTick: number,
): Pick<StepContext, 'set' | 'tempo' | 'enemyGrid' | 'flowFields'> {
  return {
    set,
    tempo: setTempo(set, startTick),
    enemyGrid: new SpatialHash(set.arena.width, set.arena.height, ENEMY_GRID_CELL_SIZE),
    flowFields: createFlowFields(
      set,
      [...content.enemies.values()].map((enemy) => enemy.radius),
    ),
  };
}

// ADR 0018: the players keep all they own; the generator, the tick, the stats and the bosses drawn stay.
export function enterSet(ctx: StepContext, set: SetDefinition, spots: readonly Vec2[]): void {
  const { state } = ctx;
  state.setId = set.id;
  state.arena = { width: set.arena.width, height: set.arena.height };
  state.set = {
    tier: 0,
    segment: 'buildup',
    phrase: 0,
    bar: 0,
    beat: 0,
    segmentStartTick: state.tick,
    startTick: state.tick,
  };
  state.core = createCore(set);
  state.speakers = createSpeakers(set);
  state.volume = 0;
  state.enemies = [];
  state.projectiles = [];
  state.traps = [];
  state.pickups = [];
  state.placed = [];
  delete state.bystanders;
  delete state.loots;
  delete state.lootsDropped;
  delete state.nextLootBar;
  delete state.lootDue;
  delete state.bombs;
  delete state.nextBombBar;
  delete state.bombDue;
  delete state.vibeRainTicks;
  delete state.walls;
  delete state.zones;
  delete state.puddles;
  delete state.spawnWindow;
  state.players.forEach((player, index) => {
    const spot = spots[index];
    if (spot === undefined) {
      throw new Error(`no spot for player ${String(player.id)} in set "${set.id}"`);
    }
    carry(state, player, spot);
  });
  Object.assign(ctx, setBindings(set, ctx.content, state.tick));

  removeGridEvents(state.events);
  tempo(ctx);
  state.events.push({ type: 'segment', segment: 'buildup', tier: 0 });
}

function carry(state: SimState, player: PlayerState, spot: Vec2): void {
  const dx = spot.x - player.x;
  const dy = spot.y - player.y;
  player.x = player.prevX = spot.x;
  player.y = player.prevY = spot.y;
  const moved = (entity: { x: number; y: number; prevX: number; prevY: number }) => {
    entity.x = entity.prevX = entity.x + dx;
    entity.y = entity.prevY = entity.y + dy;
  };
  for (const prop of state.props ?? []) {
    if (prop.playerId === player.id) {
      moved(prop);
    }
  }
  for (const recruit of state.recruits ?? []) {
    if (recruit.playerId === player.id) {
      moved(recruit);
    }
  }
  for (const slot of player.weapons ?? []) {
    shift(slot.trail, 2, dx, dy);
    shift(slot.dashTrail, 3, dx, dy);
  }
}

function shift(points: number[] | undefined, stride: number, dx: number, dy: number): void {
  for (let i = 0; points !== undefined && i + 1 < points.length; i += stride) {
    points[i] = (points[i] ?? 0) + dx;
    points[i + 1] = (points[i + 1] ?? 0) + dy;
  }
}

// The grid of the stage left must not sound on the tick the new one starts.
function removeGridEvents(events: SimEvent[]): void {
  let kept = 0;
  for (const event of events) {
    if (
      event.type !== 'beat' &&
      event.type !== 'bar' &&
      event.type !== 'phrase' &&
      event.type !== 'segment'
    ) {
      events[kept] = event;
      kept += 1;
    }
  }
  events.length = kept;
}
