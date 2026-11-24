import { TRACKS } from '../data/tracks';
import type { GameContent, SetDefinition } from '../data/types';
import { layoutGround } from '../render/ground-layout';
import { clamp } from '../shared/scalar';
import { BARS_PER_PHRASE, BEATS_PER_BAR, sixteenthTick } from '../shared/tempo';
import { resolveContent } from '../sim/content';
import { drawBoss } from '../sim/draw';
import { hashState } from '../sim/replay';
import { setTempo } from '../sim/lineup';
import { lookup } from '../sim/lookup';
import { Obstacles } from '../sim/obstacles';
import { shoreAt } from '../sim/shore';
import { edgePosition, spawnBossAt, spawnEnemy } from '../sim/systems/spawning';
import type { PlayerSlot } from '../sim/initial-state';
import { PLAYER_IDS, type SetSegment, type SimState } from '../sim/state';

export type DevMode = 'fast' | 'bench' | 'boss' | 'moment' | 'sunrise' | 'feu';

export interface DevBoss {
  readonly id: string;
  readonly tier: number;
}

// A position in a moment as Cubase writes it, from its start: `3.4` is bar 3, beat 4, and `3.4.3`
// that beat's third sixteenth, all from 1.
export interface MomentBeat {
  readonly bar: number;
  readonly beat: number;
  readonly sixteenth: number;
}

export interface DevMoment {
  // Counted from 0, as the sim counts; the URL counts from 1.
  readonly tier: number;
  readonly segment: SetSegment;
  // Replaces the run's track draw; null keeps the draw.
  readonly track: string | null;
  // Every boss of the moment falls on that beat, as if killed; null leaves them to the players.
  readonly bossFallsAt: MomentBeat | null;
  // A level's card choice opens on that beat; null waits for a level won in play.
  readonly choiceAt: MomentBeat | null;
}

const SEGMENTS: readonly SetSegment[] = ['buildup', 'break', 'drop'];

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
  readonly moment: DevMoment | null;
  // `&record`: each game downloads its recording when it ends.
  readonly record: boolean;
}

const FAST_SPEED = 8;
const MAX_SEED = 0xffffffff;
const FAST_HP = { boss: 0.05, wave: 0.5, core: 8 };
export const BENCH_ENEMIES = 300;

const MAX_BENCH_PLAYERS = PLAYER_IDS.length;

export function readDevOptions(search: string, content: GameContent): DevOptions {
  return { ...modeOptions(search, content), record: new URLSearchParams(search).has('record') };
}

function modeOptions(search: string, content: GameContent): Omit<DevOptions, 'record'> {
  const params = new URLSearchParams(search);
  const mode = params.get('dev');
  if (mode === 'boss') {
    return bossOptions(params, content);
  }
  if (mode === 'moment') {
    return momentOptions(params, content);
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
      moment: null,
    };
  }
  if (mode !== null && !params.has('stages')) {
    return modeOptions(`${search}&stages`, { ...content, sets: content.sets.slice(0, 1) });
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
      moment: null,
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
      moment: null,
    };
  }
  return {
    mode: null,
    speed: 1,
    players: 1,
    content,
    light: false,
    seed: null,
    boss: null,
    moment: null,
  };
}

function bossOptions(params: URLSearchParams, content: GameContent): Omit<DevOptions, 'record'> {
  const bossIds = content.enemies.filter((e) => e.behaviour === 'boss').map((e) => e.id);
  const id = params.get('boss') ?? '';
  if (!bossIds.includes(id)) {
    throw new DevUrlError(`Unknown boss "${id}" in ?dev=boss, pick one of: ${bossIds.join(', ')}`);
  }
  const { set, tier } = readStageTier(params, content, 'boss');
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
    boss: { id, tier },
    moment: null,
  };
}

function momentOptions(params: URLSearchParams, content: GameContent): Omit<DevOptions, 'record'> {
  const { set, tier } = readStageTier(params, content, 'moment');
  const asked = params.get('segment') ?? '';
  const segment = SEGMENTS.find((candidate) => candidate === asked);
  if (segment === undefined) {
    throw new DevUrlError(
      `Unknown segment "${asked}" in ?dev=moment, pick one of: ${SEGMENTS.join(', ')}`,
    );
  }
  return {
    mode: 'moment',
    speed: 1,
    players: readPlayers(params),
    content: { ...content, sets: [set] },
    light: false,
    seed: readSeed(params),
    boss: null,
    moment: {
      tier,
      segment,
      track: readTrack(params, set),
      bossFallsAt: readMomentBeat(params, 'bossFallsAt', set, tier, segment),
      choiceAt: readMomentBeat(params, 'choiceAt', set, tier, segment),
    },
  };
}

// A moment lasts its segment: a buildup its phrases, a break its bars, a drop until its boss is down.
function momentBars(set: SetDefinition, tier: number, segment: SetSegment): number {
  const definition = set.tiers[tier];
  if (definition === undefined) {
    throw new Error(`no tier ${String(tier + 1)} on "${set.id}"`);
  }
  switch (segment) {
    case 'buildup':
      return definition.buildupPhrases * BARS_PER_PHRASE;
    case 'break':
      return definition.breakBars;
    case 'drop':
      return Infinity;
  }
}

function readMomentBeat(
  params: URLSearchParams,
  name: string,
  set: SetDefinition,
  tier: number,
  segment: SetSegment,
): MomentBeat | null {
  const asked = params.get(name);
  if (asked === null) {
    return null;
  }
  const read = /^(\d+)(?:\.(\d+)(?:\.(\d+))?)?$/.exec(asked);
  const bar = Number(read?.[1]);
  const beat = Number(read?.[2] ?? 1);
  const sixteenth = Number(read?.[3] ?? 1);
  if (
    read === null ||
    bar < 1 ||
    [beat, sixteenth].some((count) => count < 1 || count > BEATS_PER_BAR)
  ) {
    throw new DevUrlError(
      `Unknown beat "${asked}" for &${name} in ?dev=moment, write bar.beat or bar.beat.sixteenth from 1.1, beat and sixteenth 1 to ${String(BEATS_PER_BAR)}`,
    );
  }
  if (name === 'bossFallsAt' && segment !== 'drop') {
    throw new DevUrlError(`&bossFallsAt needs a drop, where the boss is: add &segment=drop`);
  }
  const bars = momentBars(set, tier, segment);
  if (bar > bars) {
    throw new DevUrlError(
      `Bar ${String(bar)} of &${name} is past the ${segment} of tier ${String(tier + 1)} on ${set.id}, which lasts ${String(bars)} bars`,
    );
  }
  return { bar, beat, sixteenth };
}

function readStageTier(
  params: URLSearchParams,
  content: GameContent,
  mode: DevMode,
): { set: SetDefinition; tier: number } {
  const stageId = params.get('stage') ?? content.sets[0]?.id;
  const set = content.sets.find((candidate) => candidate.id === stageId);
  if (set === undefined) {
    const stageIds = content.sets.map((candidate) => candidate.id).join(', ');
    throw new DevUrlError(
      `Unknown stage "${stageId ?? ''}" in ?dev=${mode}, pick one of: ${stageIds}`,
    );
  }
  const tier = params.get('tier') ?? '1';
  if (!/^\d+$/.test(tier) || Number(tier) < 1 || Number(tier) > set.tiers.length) {
    throw new DevUrlError(
      `Unknown tier "${tier}" in ?dev=${mode}, ${set.id} has tiers 1 to ${String(set.tiers.length)}`,
    );
  }
  return { set, tier: Number(tier) - 1 };
}

// Absent, the run draws its track as usual.
function readTrack(params: URLSearchParams, set: SetDefinition): string | null {
  const track = params.get('track');
  if (track === null) {
    return null;
  }
  if (!TRACKS.some((candidate) => candidate.id === track)) {
    throw new DevUrlError(
      `Unknown track "${track}" in ?dev=moment, ${set.id} plays: ${set.trackIds.join(', ')}`,
    );
  }
  if (!set.trackIds.includes(track)) {
    throw new DevUrlError(
      `Track "${track}" is not on stage ${set.id}, pick one of: ${set.trackIds.join(', ')}`,
    );
  }
  return track;
}

function fireOptions(params: URLSearchParams, content: GameContent): Omit<DevOptions, 'record'> {
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
    moment: null,
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
  state.bosses = [boss.id];
  landOn(state, boss.tier, 'break');
}

// Bosses drawn as a run would have by then: a break's arrives on its drop, a drop's is already down.
export function momentScene(state: SimState, moment: DevMoment, content: GameContent): void {
  const set = content.sets.find((candidate) => candidate.id === state.setId);
  const tier = set?.tiers[moment.tier];
  if (set === undefined || tier === undefined) {
    throw new Error(`no tier ${String(moment.tier + 1)} on "${state.setId}" for ?dev=moment`);
  }
  const resolved = resolveContent(content);
  const bosses: string[] = [];
  const drawn = moment.tier + (moment.segment === 'buildup' ? 0 : 1);
  while (bosses.length < drawn) {
    bosses.push(drawBoss(state.seed, resolved, bosses));
  }
  state.bosses = bosses;
  landOn(state, moment.tier, moment.segment);
  const bossId = bosses.at(-1);
  if (moment.segment === 'drop' && bossId !== undefined) {
    const boss = { ...lookup(resolved.enemies, bossId, 'enemy'), ...tier.boss };
    const { width, height } = set.arena;
    spawnBossAt(
      { state, set, obstacles: new Obstacles(set.obstacles ?? [], width, height) },
      boss,
      edgePosition(state.rng, state.arena, boss.radius),
    );
  }
}

function landOn(state: SimState, tier: number, segment: SetSegment): void {
  state.set.tier = tier;
  state.set.segment = segment;
  state.set.segmentStartTick = state.tick;
  state.events = state.events.filter((event) => event.type !== 'segment');
  state.events.push({ type: 'segment', segment, tier });
}

const SUNRISE_TRAPS = [
  { kind: 'caisson-de-basse', dx: -220, dy: 140 },
  { kind: 'laser', dx: 240, dy: -120 },
];

export function sunriseScene(state: SimState, content: GameContent): void {
  const set = content.sets.find((candidate) => candidate.id === state.setId);
  if (set === undefined) {
    throw new Error(`no stage "${state.setId}" for ?dev=sunrise`);
  }
  state.set.tier = set.tiers.length;
  state.set.segment = 'drop';
  // Two traps beside the stage, so that a festival shows them burst into vibes.
  const [player] = state.players;
  if (player !== undefined) {
    SUNRISE_TRAPS.forEach(({ kind, dx, dy }) => {
      const x = state.core.x + dx;
      const y = state.core.y + dy;
      state.traps.push({
        id: state.nextEntityId,
        kind,
        ownerId: player.id,
        intensity: 1,
        direction: { x: 1, y: 0 },
        x,
        y,
        prevX: x,
        prevY: y,
      });
      state.nextEntityId += 1;
    });
  }
}

// Where a game's start waits: `?dev=moment` and a film land their scene once the files of the
// track are decoded, so that the recording is heard from its first bar (ADR 0022); any other start
// lands at once.
export interface Landings {
  // Lands the start of `match` unless another match is current by the time its files are heard.
  begin(match: object, loaded: () => Promise<void>, land: () => void): void;
  // The current match waits for its files: the game does not step it.
  waiting(): boolean;
  // The player left the start before its files decoded: it never lands.
  cancel(): void;
}

export function createLandings(waits: boolean, current: () => object): Landings {
  let pending: object | null = null;
  return {
    begin(match, loaded, land) {
      if (!waits) {
        land();
        return;
      }
      pending = match;
      void loaded().then(() => {
        if (pending !== match) {
          return;
        }
        pending = null;
        if (current() === match) {
          land();
        }
      });
    },
    waiting() {
      return pending !== null && pending === current();
    },
    cancel() {
      pending = null;
    },
  };
}

// Before each step of a moment: what its link asks for on the tick that step plays, counted from
// the tick the moment landed on. Null when it asks for nothing.
export function momentSteps(
  state: SimState,
  dev: Pick<DevOptions, 'moment' | 'content'>,
): ((state: SimState) => void) | null {
  const { moment } = dev;
  const set = dev.content.sets.find((candidate) => candidate.id === state.setId);
  if (moment === null || set === undefined) {
    return null;
  }
  const tempo = setTempo(set);
  const start = state.tick;
  // The landing tick is no step's: a beat on it plays on the first.
  const tickOf = (at: MomentBeat | null) =>
    at === null
      ? null
      : Math.max(
          start + 1,
          start +
            (at.bar - 1) * tempo.ticksPerBar +
            (at.beat - 1) * tempo.ticksPerBeat +
            sixteenthTick(at.sixteenth - 1, tempo),
        );
  const fall = tickOf(moment.bossFallsAt);
  const choice = tickOf(moment.choiceAt);
  if (fall === null && choice === null) {
    return null;
  }
  return (current) => {
    // A choice holds the tick: the steps it lasts play the same tick again.
    if (current.status !== 'running') {
      return;
    }
    const next = current.tick + 1;
    if (next === fall) {
      bossesFall(current);
    }
    if (next === choice) {
      levelUp(current);
    }
  };
}

function bossesFall(state: SimState): void {
  const killer = state.players[0]?.id;
  for (const enemy of state.enemies) {
    if (enemy.isBoss) {
      enemy.hp = 0;
      if (killer !== undefined) {
        enemy.lastHitBy = killer;
      }
    }
  }
  delete state.bossesDue;
}

function levelUp(state: SimState): void {
  for (const player of state.players) {
    player.vibes = Math.max(player.vibes, player.vibesToNextLevel);
  }
}

export function devScene(
  state: SimState,
  dev: Pick<DevOptions, 'mode' | 'boss' | 'moment' | 'content'>,
): void {
  if (dev.mode === 'bench') {
    benchScene(state, dev.content, state.seed, BENCH_ENEMIES);
  }
  if (dev.boss !== null) {
    bossScene(state, dev.boss);
  }
  if (dev.moment !== null) {
    momentScene(state, dev.moment, dev.content);
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
