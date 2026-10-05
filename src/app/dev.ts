import type { GameContent } from '../data/types';
import { layoutGround, shoreAt } from '../render/ground-layout';
import { spawnEnemy } from '../sim/systems/spawning';
import type { SimState } from '../sim/state';

// Development modes, only behind the `dev` URL parameter, never by default:
// - `?dev=fast`: a short set (one phrase per tier, one-bar break, weaker bad vibes, sturdier
//   scene) played four times faster, to reach the end of a game in an end-to-end test;
// - `?dev=bench`: the real set with 300 bad vibes on the lake shore that neither die nor kill, three
//   weapons and a plugged speaker, to measure a frame.
// Both expose `window.ozoboom` (live state, the seats of the match and frame timings) and log the timings every second.
export type DevMode = 'fast' | 'bench';

export interface DevOptions {
  readonly mode: DevMode | null;
  readonly speed: number;
  readonly content: GameContent;
}

const FAST_SPEED = 4;
const FAST_HP = { boss: 0.05, wave: 0.5, core: 4 };
export const BENCH_ENEMIES = 300;

export function readDevOptions(search: string, content: GameContent): DevOptions {
  const mode = new URLSearchParams(search).get('dev');
  if (mode === 'fast') {
    return { mode, speed: FAST_SPEED, content: fastContent(content) };
  }
  if (mode === 'bench') {
    return { mode, speed: 1, content };
  }
  return { mode: null, speed: 1, content };
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
  for (const player of state.players) {
    player.x = player.prevX = shoreAt(layout, state.arena.height / 2) + SHORE_BAND.from + 40;
    player.y = player.prevY = state.arena.height / 2;
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

export interface DevProbe {
  readonly cost: FrameCost;
  endFrame(time: number): void;
}

export function createDevProbe(state: () => SimState, seats: () => readonly unknown[]): DevProbe {
  const cost: FrameCost = { sim: 0, render: 0, ui: 0 };
  const total: FrameCost = { sim: 0, render: 0, ui: 0 };
  let frames = 0;
  let since = performance.now();
  const report = {
    fps: 0,
    enemies: 0,
    perFrameMs: { sim: 0, render: 0, ui: 0 },
  };
  Object.assign(window, {
    ozoboom: {
      get state() {
        return state();
      },
      get report() {
        return report;
      },
      get seats() {
        return seats();
      },
    },
  });

  return {
    cost,
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
