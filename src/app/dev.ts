import type { GameContent } from '../data/types';
import { spawnEnemy } from '../sim/systems/spawning';
import type { SimState } from '../sim/state';

// Development modes, only behind the `dev` URL parameter, never by default:
// - `?dev=fast`: a short set (one phrase per tier, one-bar break, weaker bad vibes, sturdier
//   scene) played four times faster, to reach the end of a game in an end-to-end test;
// - `?dev=bench`: the real set with 300 bad vibes that neither die nor kill, to measure a frame.
// Both expose `window.ozoboom` (live state and frame timings) and log the timings every second.
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

export function crowd(state: SimState, content: GameContent, count: number): void {
  const kinds = content.enemies.filter((enemy) => enemy.behaviour !== 'boss');
  const { width, height } = state.arena;
  for (let index = 0; index < count; index++) {
    const kind = kinds[index % kinds.length];
    if (kind === undefined) {
      throw new Error('The bench needs at least one enemy that is not a boss');
    }
    const turn = (index / count) * 2 * Math.PI * 7;
    const distance = 160 + ((index * 37) % 420);
    const x = Math.min(
      Math.max(state.core.x + Math.cos(turn) * distance, kind.radius),
      width - kind.radius,
    );
    const y = Math.min(
      Math.max(state.core.y + Math.sin(turn) * distance, kind.radius),
      height - kind.radius,
    );
    const enemy = spawnEnemy(state, kind, x, y, false);
    enemy.hp = enemy.maxHp = Number.MAX_SAFE_INTEGER;
  }
  state.core.hp = state.core.maxHp = Number.MAX_SAFE_INTEGER;
  for (const player of state.players) {
    player.hp = player.maxHp = Number.MAX_SAFE_INTEGER;
  }
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

export function createDevProbe(state: () => SimState): DevProbe {
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
