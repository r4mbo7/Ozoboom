import { SOIREE_OUVERTURE } from '../data/tracks';
import type { MusicTrack, SetDefinition } from '../data/types';
import type { SimState } from '../sim/state';
import { createAmbience, type Ambience } from './ambience';
import { FULL_MUSIC } from './full';
import { createMasterChain, type MasterChain } from './master';
import { createMusic, type Music } from './music';
import { createSfx, type Sfx, type SfxLookups, type TrapEffectOf } from './sfx';
import type { AudioEngine, Mood } from './types';

export interface AudioEngineOptions {
  readonly track?: MusicTrack;
  readonly breakBars?: (tier: number) => number;
  // Absent means the main stage.
  readonly setOf?: (setId: string) => SetDefinition | undefined;
  // When the one playing is not among the tracks of the set a festival enters.
  readonly trackFor?: (set: SetDefinition) => MusicTrack;
  readonly trapEffectOf?: TrapEffectOf;
  readonly sfxLookups?: SfxLookups;
  readonly createContext?: () => BaseAudioContext;
  readonly onKickScheduled?: (tick: number, time: number) => void;
  // The offline bench drives it from the audio clock.
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
  let track = options.track ?? SOIREE_OUVERTURE;
  let running: Running | null = null;
  let muted = false;
  let volume = 1;
  let hitSound = true;
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
      const tempo = music.tempo();
      ambience.enter(music.fadeOut(context.currentTime), tempo);
    }
    if (!ambience.pump() && menuAt === null) {
      stopPumping?.();
      stopPumping = null;
    }
  };

  // A mood asked in the same frame as an update waits for it: the menu ambience must know the ending has begun.
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
      if (music.track() !== track) {
        track = music.track();
        sfx.setKey(track);
      }
      sfx.setTempo(music.tempo());
      sfx.setClock(music.clock());
    }
    sfx.beginFrame();
    applyMood();
  };

  const open = (): Running => {
    const context = (options.createContext ?? (() => new AudioContext()))();
    const master = createMasterChain(context, muted, volume);
    const sfx = createSfx(master.sfx, trapEffectOf, options.sfxLookups, track);
    sfx.setHitSound(hitSound);
    return {
      context,
      master,
      music: (FULL_MUSIC.festival ?? createMusic)(
        master.music,
        { track, breakBars, setOf: options.setOf, onKickScheduled: options.onKickScheduled },
        options.trackFor,
      ),
      sfx,
      ambience: createAmbience(master.music),
    };
  };

  return {
    start() {
      if (running === null) {
        running = open();
        applyMood();
      }
      // A context opened before any gesture stays suspended: the next start, from a gesture, resumes it.
      const { context } = running;
      return context instanceof AudioContext && context.state !== 'running'
        ? context.resume()
        : Promise.resolve();
    },
    update(state) {
      if (running === null || isRealtimeStalled(running.context)) {
        return;
      }
      running.sfx.play(
        state.events,
        running.context.currentTime,
        state.players,
        state.core,
        state.enemies,
      );
      if (latest === null) {
        queueMicrotask(flush);
      }
      latest = state;
    },
    cue(name, variant = 0) {
      if (running === null || isRealtimeStalled(running.context)) {
        return;
      }
      // Cues come from the lobby, where no update runs to open the frame.
      running.sfx.beginFrame();
      running.sfx.cue(name, running.context.currentTime, variant);
    },
    setMuted(value) {
      muted = value;
      running?.master.setMuted(value);
    },
    setVolume(value) {
      volume = value;
      running?.master.setVolume(value);
    },
    setHitSound(value) {
      hitSound = value;
      running?.sfx.setHitSound(value);
    },
    setTrack(value) {
      track = value;
      running?.music.setTrack(value);
      running?.sfx.setKey(value);
    },
    setMood(value) {
      mood = value;
      if (latest === null) {
        applyMood();
      }
    },
    menuPosition() {
      if (running === null || muted || volume === 0 || isRealtimeStalled(running.context)) {
        return null;
      }
      const now = heardNow(running.context);
      return now === null ? null : running.ambience.position(now);
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
      latest = null;
    },
  };
}
