import type { SimState } from '../sim/state';
import { createMasterChain, type MasterChain } from './master';
import { createMusic, type Music } from './music';
import { createSfx, type Sfx, type TrapEffectOf } from './sfx';
import type { AudioEngine } from './types';

export interface AudioEngineOptions {
  readonly breakBars?: (tier: number) => number;
  readonly trapEffectOf?: TrapEffectOf;
  readonly createContext?: () => BaseAudioContext;
  readonly onKickScheduled?: (tick: number, time: number) => void;
}

interface Running {
  context: BaseAudioContext;
  master: MasterChain;
  music: Music;
  sfx: Sfx;
}

const DEFAULT_BREAK_BARS = 4;
const OUTPUT_CLOCK_WARMUP_SECONDS = 0.1;
const OUTPUT_CLOCK_GRACE_SECONDS = 0.5;

export function heardNow(context: BaseAudioContext): number | null {
  if (!(context instanceof AudioContext)) {
    return context.currentTime;
  }
  const { contextTime, performanceTime } = context.getOutputTimestamp();
  if (
    contextTime !== undefined &&
    performanceTime !== undefined &&
    contextTime >= OUTPUT_CLOCK_WARMUP_SECONDS
  ) {
    const estimate = contextTime + (performance.now() - performanceTime) / 1000;
    return Math.min(estimate, context.currentTime);
  }
  return context.currentTime > OUTPUT_CLOCK_GRACE_SECONDS ? context.currentTime : null;
}

function isRealtimeStalled(context: BaseAudioContext): boolean {
  return context instanceof AudioContext && context.state !== 'running';
}

export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  const breakBars = options.breakBars ?? (() => DEFAULT_BREAK_BARS);
  const trapEffectOf = options.trapEffectOf ?? ((kind: string) => kind);
  let running: Running | null = null;
  let starting: Promise<void> | null = null;
  let muted = false;
  let latest: SimState | null = null;

  const flush = () => {
    const state = latest;
    latest = null;
    if (running === null || state === null) {
      return;
    }
    const { context, music, sfx } = running;
    const now = heardNow(context);
    if (now !== null) {
      music.update(state, now, context.currentTime);
    }
    sfx.beginFrame();
  };

  const begin = async () => {
    const context = (options.createContext ?? (() => new AudioContext()))();
    const master = createMasterChain(context);
    master.setMuted(muted);
    running = {
      context,
      master,
      music: createMusic(master.music, {
        breakBars,
        onKickScheduled: options.onKickScheduled,
      }),
      sfx: createSfx(master.sfx, trapEffectOf),
    };
    if (context instanceof AudioContext) {
      await context.resume();
    }
  };

  return {
    start() {
      starting ??= begin();
      return starting;
    },
    update(state) {
      if (running === null || isRealtimeStalled(running.context)) {
        return;
      }
      running.sfx.play(state.events, running.context.currentTime);
      if (latest === null) {
        queueMicrotask(flush);
      }
      latest = state;
    },
    setMuted(value) {
      muted = value;
      running?.master.setMuted(value);
    },
    destroy() {
      if (running !== null && running.context instanceof AudioContext) {
        void running.context.close();
      }
      running = null;
      starting = null;
      latest = null;
    },
  };
}
