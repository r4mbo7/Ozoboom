import type { GameContent } from '../data/types';
import { layoutGround, shoreAt } from '../render/ground-layout';
import { hashState } from '../sim/replay';
import { spawnEnemy } from '../sim/systems/spawning';
import type { PlayerSlot } from '../sim/initial-state';
import type { PlayerId, SimState } from '../sim/state';

// Development modes, only behind the `dev` URL parameter, never by default:
// - `?dev=fast`: a short set (one phrase per tier, one-bar break, weaker bad vibes, sturdier
//   scene) played eight times faster, slower when the browser draws under 29 frames per second, and
//   drawn light, to reach the end of a game in a browser test;
// - `?dev=bench`: the real set with 300 bad vibes on the lake shore that neither die nor kill, three
//   weapons and a plugged speaker, to measure a frame. `&players=4` seats four players on one
//   screen instead (one of each class, then the first again), three weapons each, camera on everyone.
// Both expose `window.ozoboom` (live state, the seats of the match and frame timings) and log the timings every second.
export type DevMode = 'fast' | 'bench';

export interface DevOptions {
  readonly mode: DevMode | null;
  readonly speed: number;
  // Players of the bench, 1 unless `&players=` says up to 4.
  readonly players: number;
  readonly content: GameContent;
}

const FAST_SPEED = 8;
const FAST_HP = { boss: 0.05, wave: 0.5, core: 4 };
export const BENCH_ENEMIES = 300;

const BENCH_PLAYER_IDS: readonly PlayerId[] = [0, 1, 2, 3];
const MAX_BENCH_PLAYERS = BENCH_PLAYER_IDS.length;

export function readDevOptions(search: string, content: GameContent): DevOptions {
  const params = new URLSearchParams(search);
  const mode = params.get('dev');
  if (mode === 'fast') {
    return { mode, speed: FAST_SPEED, players: 1, content: fastContent(content) };
  }
  if (mode === 'bench') {
    const asked = Number(params.get('players') ?? 1);
    const players = Number.isInteger(asked) ? Math.min(Math.max(asked, 1), MAX_BENCH_PLAYERS) : 1;
    return { mode, speed: 1, players, content };
  }
  return { mode: null, speed: 1, players: 1, content };
}

// One of each class in the order of the content, then the first again: four players on one screen.
export function benchSlots(content: GameContent, players: number): PlayerSlot[] {
  const classes = content.classes;
  return BENCH_PLAYER_IDS.slice(0, players).map((id) => {
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
    enemies: content.enemies.map((enemy) => ({
      ...enemy,
      maxHp: enemy.maxHp * (enemy.behaviour === 'boss' ? FAST_HP.boss : FAST_HP.wave),
    })),
    sets: content.sets.map((set) => ({
      ...set,
      core: { ...set.core, maxHp: set.core.maxHp * FAST_HP.core },
      tiers: set.tiers.map((tier) => ({ ...tier, buildupPhrases: 1, breakBars: 1 })),
    })),
  };
}

const BENCH_WEAPONS = ['baton-du-diable', 'monocycle', 'assiettes-chinoises'] as const;
const BENCH_SPEAKER = 'foret';
const SHORE_BAND = { from: 40, width: 360 } as const;
const SHORE_MARGIN = 60;
const PLAYER_GAP = 50;

// The load of a crowded night: 300 bad vibes on the lake shore that neither die nor kill, the three
// weapon slots full and one speaker plugged, so that every system and every layer draws.
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
    const y = Math.min(
      Math.max(SHORE_MARGIN + ((index * 61) % (height - 2 * SHORE_MARGIN)), kind.radius),
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

// What `window.ozoboom.online` shows of an online game, read live.
export interface OnlineProbe {
  readonly role: 'host' | 'guest';
  readonly pending: number;
  readonly roundTripMs: number | null;
  // How long the transport took to open, in milliseconds.
  readonly connectMs: number | null;
}

export interface DevProbe {
  readonly cost: FrameCost;
  // A game version the page pretends to have, set from `window.ozoboom.forceVersion`.
  readonly forcedVersion: string | null;
  endFrame(time: number): void;
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
  const exposed = {
    forceVersion: null as string | null,
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
