import type { SimState } from '../sim/state';
import { createAmbience, type Ambience } from './ambience';
import { createMasterChain, type MasterChain } from './master';
import { createMusic, type Music } from './music';
import { createSfx, type Sfx, type SfxLookups, type TrapEffectOf } from './sfx';
import type { AudioEngine, Mood } from './types';

export interface AudioEngineOptions {
  readonly breakBars?: (tier: number) => number;
  readonly trapEffectOf?: TrapEffectOf;
  readonly sfxLookups?: SfxLookups;
  readonly createContext?: () => BaseAudioContext;
  readonly onKickScheduled?: (tick: number, time: number) => void;
  // Calls back regularly while the menu ambience plays, and returns how to stop. The offline bench
  // drives it from the audio clock.
  readonly repeat?: (callback: () => void) => () => void;
}

interface Running {
  context: BaseAudioContext;
  master: MasterChain;
  music: Music;
  sfx: Sfx;
  ambience: Ambience;
}

const DEFAULT_BREAK_BARS = 4;
const OUTPUT_CLOCK_WARMUP_SECONDS = 0.1;
const OUTPUT_CLOCK_GRACE_SECONDS = 0.5;
const AMBIENCE_PUMP_MS = 100;

function everyPump(callback: () => void): () => void {
  const timer = setInterval(callback, AMBIENCE_PUMP_MS);
  return () => {
    clearInterval(timer);
  };
}

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
  const repeat = options.repeat ?? everyPump;
  let running: Running | null = null;
  let starting: Promise<void> | null = null;
  let muted = false;
  let latest: SimState | null = null;
  let mood: Mood = 'set';
  let heard: Mood = 'set';
  let menuAt: number | null = null;
  let stopPumping: (() => void) | null = null;

  const pump = () => {
    if (running === null) {
      return;
    }
    const { context, music, ambience } = running;
    if (menuAt !== null && context.currentTime >= menuAt) {
      menuAt = null;
      ambience.enter(music.fadeOut(context.currentTime));
    }
    if (!ambience.pump() && menuAt === null) {
      stopPumping?.();
      stopPumping = null;
    }
  };

  // A mood asked for in the same frame as an update waits for it: the end screen opens on the
  // update that ends the game, and the menu ambience must know the ending has begun.
  const applyMood = () => {
    if (running === null || heard === mood) {
      return;
    }
    heard = mood;
    const { context, music, ambience } = running;
    if (mood === 'menu') {
      menuAt = music.menuAt(context.currentTime);
    } else {
      menuAt = null;
      ambience.leave();
      music.fadeIn();
    }
    stopPumping ??= repeat(pump);
    pump();
  };

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
    applyMood();
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
      sfx: createSfx(master.sfx, trapEffectOf, options.sfxLookups),
      ambience: createAmbience(master.music),
    };
    applyMood();
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
      running.sfx.play(state.events, running.context.currentTime, state.players);
      if (latest === null) {
        queueMicrotask(flush);
      }
      latest = state;
    },
    cue(name) {
      if (running === null || isRealtimeStalled(running.context)) {
        return;
      }
      // Cues come from the lobby, where no update runs to open the frame.
      running.sfx.beginFrame();
      running.sfx.cue(name, running.context.currentTime);
    },
    setMuted(value) {
      muted = value;
      running?.master.setMuted(value);
    },
    setMood(value) {
      mood = value;
      if (latest === null) {
        applyMood();
      }
    },
    destroy() {
      stopPumping?.();
      stopPumping = null;
      menuAt = null;
      heard = 'set';
      if (running !== null && running.context instanceof AudioContext) {
        void running.context.close();
      }
      running = null;
      starting = null;
      latest = null;
    },
  };
}
