import type { GameContent } from '../data/types';
import { layoutGround, shoreAt } from '../render/ground-layout';
import { clamp } from '../shared/scalar';
import { hashState } from '../sim/replay';
import { setTempo } from '../sim/lineup';
import { spawnEnemy } from '../sim/systems/spawning';
import type { PlayerSlot } from '../sim/initial-state';
import { PLAYER_IDS, type SimState } from '../sim/state';

export type DevMode = 'fast' | 'bench' | 'boss' | 'sunrise' | 'feu';

export interface DevBoss {
  readonly id: string;
  readonly tier: number;
}

export class DevUrlError extends Error {}

export interface DevOptions {
  readonly mode: DevMode | null;
  readonly speed: number;
  readonly players: number;
  readonly content: GameContent;
  // Half resolution without antialiasing.
  readonly light: boolean;
  // Drawn at random when null.
  readonly seed: number | null;
  readonly boss: DevBoss | null;
}

const FAST_SPEED = 8;
const MAX_SEED = 0xffffffff;
const FAST_HP = { boss: 0.05, wave: 0.5, core: 8 };
export const BENCH_ENEMIES = 300;

const MAX_BENCH_PLAYERS = PLAYER_IDS.length;

export function readDevOptions(search: string, content: GameContent): DevOptions {
  const params = new URLSearchParams(search);
  const mode = params.get('dev');
  if (mode === 'boss') {
    return bossOptions(params, content);
  }
  if (mode === 'feu') {
    return fireOptions(params, content);
  }
  if (mode === 'sunrise') {
    return {
      mode,
      speed: 1,
      players: 1,
      content,
      light: false,
      seed: readSeed(params),
      boss: null,
    };
  }
  if (mode !== null && !params.has('stages')) {
    return readDevOptions(`${search}&stages`, { ...content, sets: content.sets.slice(0, 1) });
  }
  if (mode === 'fast') {
    return {
      mode,
      speed: FAST_SPEED,
      players: 1,
      content: fastContent(content),
      light: !params.has('crisp'),
      seed: readSeed(params),
      boss: null,
    };
  }
  if (mode === 'bench') {
    return {
      mode,
      speed: 1,
      players: readPlayers(params),
      content,
      light: false,
      seed: readSeed(params),
      boss: null,
    };
  }
  return { mode: null, speed: 1, players: 1, content, light: false, seed: null, boss: null };
}

function bossOptions(params: URLSearchParams, content: GameContent): DevOptions {
  const bossIds = content.enemies.filter((e) => e.behaviour === 'boss').map((e) => e.id);
  const id = params.get('boss') ?? '';
  if (!bossIds.includes(id)) {
    throw new DevUrlError(`Unknown boss "${id}" in ?dev=boss, pick one of: ${bossIds.join(', ')}`);
  }
  const stageId = params.get('stage') ?? content.sets[0]?.id;
  const set = content.sets.find((candidate) => candidate.id === stageId);
  if (set === undefined) {
    const stageIds = content.sets.map((candidate) => candidate.id).join(', ');
    throw new DevUrlError(
      `Unknown stage "${stageId ?? ''}" in ?dev=boss, pick one of: ${stageIds}`,
    );
  }
  const tier = params.get('tier') ?? '1';
  if (!/^\d+$/.test(tier) || Number(tier) < 1 || Number(tier) > set.tiers.length) {
    throw new DevUrlError(
      `Unknown tier "${tier}" in ?dev=boss, ${set.id} has tiers 1 to ${String(set.tiers.length)}`,
    );
  }
  return {
    mode: 'boss',
    speed: 1,
    players: readPlayers(params),
    content: {
      ...content,
      enemies: content.enemies.filter((enemy) => enemy.behaviour !== 'boss' || enemy.id === id),
      sets: [set],
    },
    light: false,
    seed: readSeed(params),
    boss: { id, tier: Number(tier) - 1 },
  };
}

function fireOptions(params: URLSearchParams, content: GameContent): DevOptions {
  const stageIds = (content.summons ?? []).map((summon) => summon.setId);
  const stageId = params.get('stage') ?? stageIds[0] ?? '';
  const set = content.sets.find((candidate) => candidate.id === stageId);
  if (set === undefined || !stageIds.includes(stageId)) {
    throw new DevUrlError(
      `No fire nor giants on stage "${stageId}" in ?dev=feu, pick one of: ${stageIds.join(', ')}`,
    );
  }
  return {
    mode: 'feu',
    speed: 1,
    players: 1,
    content: { ...content, sets: [set] },
    light: false,
    seed: readSeed(params),
    boss: null,
  };
}

export function fireScene(state: SimState, content: GameContent): void {
  const set = content.sets.find((candidate) => candidate.id === state.setId);
  const source = content.summons?.find((summon) => summon.setId === state.setId)?.sources[0];
  if (set === undefined || source === undefined) {
    throw new Error(`no fire nor giants on "${state.setId}" for ?dev=feu`);
  }
  const phrases = set.tiers[0]?.buildupPhrases ?? 1;
  state.set.segmentStartTick = state.tick - (phrases - 1) * setTempo(set).ticksPerPhrase;
  state.players.forEach((player, index) => {
    player.x = player.prevX = source.x - (source.radius + 30) * (index % 2 === 0 ? 1 : -1);
    player.y = player.prevY = source.y - 40 * Math.floor(index / 2);
  });
}

// The game starts at the break of the tier, its boss already drawn so that its arrival shows.
export function bossScene(state: SimState, boss: DevBoss): void {
  state.set.tier = boss.tier;
  state.set.segment = 'break';
  state.set.segmentStartTick = state.tick;
  state.bosses = [boss.id];
  state.events = state.events.filter((event) => event.type !== 'segment');
  state.events.push({ type: 'segment', segment: 'break', tier: boss.tier });
}

export function sunriseScene(state: SimState, content: GameContent): void {
  const set = content.sets.find((candidate) => candidate.id === state.setId);
  if (set === undefined) {
    throw new Error(`no stage "${state.setId}" for ?dev=sunrise`);
  }
  state.set.tier = set.tiers.length;
  state.set.segment = 'drop';
}

export function devScene(
  state: SimState,
  dev: Pick<DevOptions, 'mode' | 'boss' | 'content'>,
): void {
  if (dev.mode === 'bench') {
    benchScene(state, dev.content, state.seed, BENCH_ENEMIES);
  }
  if (dev.boss !== null) {
    bossScene(state, dev.boss);
  }
  if (dev.mode === 'feu') {
    fireScene(state, dev.content);
  }
  if (dev.mode === 'sunrise') {
    sunriseScene(state, dev.content);
  }
}

function readSeed(params: URLSearchParams): number | null {
  const asked = params.get('seed');
  if (asked === null || !/^\d+$/.test(asked)) {
    return null;
  }
  const seed = Number(asked);
  return seed <= MAX_SEED ? seed : null;
}

function readPlayers(params: URLSearchParams): number {
  const asked = Number(params.get('players') ?? 1);
  return Number.isInteger(asked) ? clamp(asked, 1, MAX_BENCH_PLAYERS) : 1;
}

export function benchSlots(content: GameContent, players: number): PlayerSlot[] {
  const classes = content.classes;
  return PLAYER_IDS.slice(0, players).map((id) => {
    const definition = classes[id % classes.length];
    if (definition === undefined) {
      throw new Error('The bench needs at least one class');
    }
    return { id, classId: definition.id };
  });
}

export function fastContent(content: GameContent): GameContent {
  return {
    ...content,
    enemies: content.enemies.map((enemy) => ({ ...enemy, maxHp: enemy.maxHp * FAST_HP.wave })),
    sets: content.sets.map((set) => ({
      ...set,
      core: { ...set.core, maxHp: set.core.maxHp * FAST_HP.core },
      tiers: set.tiers.map((tier) => ({
        ...tier,
        buildupPhrases: 1,
        breakBars: 1,
        boss: { ...tier.boss, maxHp: tier.boss.maxHp * FAST_HP.boss },
      })),
    })),
  };
}

const BENCH_WEAPONS = ['baton-du-diable', 'monocycle', 'assiettes-chinoises'] as const;
const BENCH_SPEAKER = 'foret';
const SHORE_BAND = { from: 40, width: 360 } as const;
const SHORE_MARGIN = 60;
const PLAYER_GAP = 50;

export function benchScene(
  state: SimState,
  content: GameContent,
  seed: number,
  count: number,
): void {
  const kinds = content.enemies.filter((enemy) => enemy.behaviour !== 'boss');
  const layout = layoutGround(seed, state.arena);
  const { width, height } = state.arena;
  for (let index = 0; index < count; index++) {
    const kind = kinds[index % kinds.length];
    if (kind === undefined) {
      throw new Error('The bench needs at least one enemy that is not a boss');
    }
    const y = clamp(
      SHORE_MARGIN + ((index * 61) % (height - 2 * SHORE_MARGIN)),
      kind.radius,
      height - kind.radius,
    );
    const x = Math.min(
      shoreAt(layout, y) + SHORE_BAND.from + ((index * 37) % SHORE_BAND.width),
      width - kind.radius,
    );
    const enemy = spawnEnemy(state, kind, x, y, false);
    enemy.hp = enemy.maxHp = Number.MAX_SAFE_INTEGER;
    enemy.damage = 0;
  }
  state.core.hp = state.core.maxHp = Number.MAX_SAFE_INTEGER;
  for (const [index, player] of state.players.entries()) {
    player.x = player.prevX = shoreAt(layout, state.arena.height / 2) + SHORE_BAND.from + 40;
    player.y = player.prevY =
      state.arena.height / 2 + (index - (state.players.length - 1) / 2) * PLAYER_GAP;
    player.weapons = BENCH_WEAPONS.map((id) => ({ id, level: 1, phase: 0 }));
  }
  const speaker = state.speakers?.find((candidate) => candidate.id === BENCH_SPEAKER);
  if (speaker === undefined) {
    throw new Error(`The bench needs the speaker ${BENCH_SPEAKER}`);
  }
  speaker.plugged = true;
  state.volume = (state.volume ?? 0) + 1;
}

export interface FrameCost {
  sim: number;
  render: number;
  ui: number;
}

export interface OnlineProbe {
  readonly role: 'host' | 'guest';
  readonly pending: number;
  readonly roundTripMs: number | null;
  readonly connectMs: number | null;
}

export interface DevProbe {
  readonly cost: FrameCost;
  readonly forcedVersion: string | null;
  // True when a test's player has played and may have changed the devices.
  afterStep(): boolean;
  endFrame(time: number): void;
}

interface ExposedProbe {
  forceVersion: string | null;
  onStep: (() => void) | null;
  readonly state: SimState;
  readonly report: { fps: number; enemies: number; perFrameMs: FrameCost };
  readonly seats: readonly unknown[];
  readonly hash: string;
  readonly online: OnlineProbe | null;
}

export function createDevProbe(
  state: () => SimState,
  seats: () => readonly unknown[],
  online: () => OnlineProbe | null = () => null,
): DevProbe {
  const cost: FrameCost = { sim: 0, render: 0, ui: 0 };
  const total: FrameCost = { sim: 0, render: 0, ui: 0 };
  let frames = 0;
  let since = performance.now();
  const report = {
    fps: 0,
    enemies: 0,
    perFrameMs: { sim: 0, render: 0, ui: 0 },
  };
  const exposed: ExposedProbe = {
    forceVersion: null,
    onStep: null,
    get state() {
      return state();
    },
    get report() {
      return report;
    },
    get seats() {
      return seats();
    },
    get hash() {
      return hashState(state());
    },
    get online() {
      return online();
    },
  };
  Object.assign(window, { ozoboom: exposed });

  return {
    cost,
    get forcedVersion() {
      return exposed.forceVersion;
    },
    afterStep() {
      if (exposed.onStep === null) {
        return false;
      }
      exposed.onStep();
      return true;
    },
    endFrame(time) {
      total.sim += cost.sim;
      total.render += cost.render;
      total.ui += cost.ui;
      cost.sim = cost.render = cost.ui = 0;
      frames += 1;
      if (time - since < 1000) {
        return;
      }
      report.fps = (frames * 1000) / (time - since);
      report.enemies = state().enemies.length;
      report.perFrameMs = {
        sim: total.sim / frames,
        render: total.render / frames,
        ui: total.ui / frames,
      };
      console.info(
        `[dev] ${report.fps.toFixed(1)} fps, ${String(report.enemies)} enemies, per frame: ` +
          `sim ${report.perFrameMs.sim.toFixed(2)} ms, render ${report.perFrameMs.render.toFixed(2)} ms, ` +
          `ui ${report.perFrameMs.ui.toFixed(2)} ms`,
      );
      total.sim = total.render = total.ui = 0;
      frames = 0;
      since = time;
    },
  };
}
