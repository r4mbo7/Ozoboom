import { SOIREE_OUVERTURE } from '../data/tracks';
import type { MusicTrack, SetDefinition } from '../data/types';
import type { SimState } from '../sim/state';
import { createAmbience, type Ambience } from './ambience';
import { FULL_MUSIC, FULL_SOUNDS, FULL_SYNTH_LUFS } from './full';
import { createMasterChain, type MasterChain } from './master';
import {
  MENU_RECORDING,
  createRecordingVoice,
  type RecordingLoad,
  type RecordingPartName,
  type RecordingVoice,
} from './menu-track';
import { createMusic, type Music } from './music';
import { loadSamples, type SampleBank } from './samples';
import {
  createSfx,
  specialTakes,
  type Sfx,
  type SfxLookups,
  type SpecialTake,
  type TrapEffectOf,
} from './sfx';
import type { MenuHeard } from '../shared/menu-score';
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
  // A film's four-channel context: music and effects on two stereo pairs (createMasterChain).
  readonly stems?: boolean;
  readonly onKickScheduled?: (tick: number, time: number) => void;
  // The offline bench drives it from the audio clock.
  readonly repeat?: (callback: () => void) => () => void;
  // The menu track (MENU_RECORDING), loaded in the background: the menus wait for it in silence, and
  // play the ambience only when it is absent or does not decode.
  readonly menuTrack?: (context: BaseAudioContext) => RecordingLoad;
  // The artists' files of the effects, decoded from the opening with the engine's own context.
  // Absent means those placed with `pnpm sounds`.
  readonly samples?: (context: BaseAudioContext) => SampleBank;
}

interface Running {
  context: BaseAudioContext;
  master: MasterChain;
  music: Music;
  sfx: Sfx;
  samples: SampleBank;
  ambience: Ambience;
  // What the menus play: their track, silent until its first part decodes, or the ambience.
  menus: RecordingVoice | 'ambience';
  // The track given up when its opening or loop does not decode, pumped until its fade has stopped it.
  dropped: RecordingVoice | null;
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

function placedSamples(context: BaseAudioContext): SampleBank {
  return loadSamples(context, FULL_SOUNDS.samples ?? {}, FULL_SYNTH_LUFS);
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
      const origin = music.fadeOut(context.currentTime);
      menuVoice(running).enter(origin, tempo);
    }
    const ambienceSounds = ambience.pump();
    const trackSounds = trackOf(running)?.pump() ?? false;
    const droppedSounds = running.dropped?.pump() ?? false;
    if (!droppedSounds) {
      running.dropped = null;
    }
    if (!ambienceSounds && !trackSounds && !droppedSounds && menuAt === null) {
      stopPumping?.();
      stopPumping = null;
    }
  };

  const trackOf = ({ menus }: Running): RecordingVoice | null =>
    menus === 'ambience' ? null : menus;

  const menuVoice = (opened: Running): Ambience =>
    mood === 'set' ? opened.ambience : (trackOf(opened) ?? opened.ambience);

  // A mood asked in the same frame as an update waits for it: the menu ambience must know the ending has begun.
  const applyMood = () => {
    if (running === null || heard === mood) {
      return;
    }
    const before = heard;
    heard = mood;
    const { context, music, ambience } = running;
    if (mood === 'set') {
      menuAt = null;
      ambience.leave();
      trackOf(running)?.leave();
      music.fadeIn();
    } else {
      const voice = menuVoice(running);
      for (const other of [ambience, trackOf(running)]) {
        if (other !== null && other !== voice) {
          other.leave();
        }
      }
      const track = trackOf(running);
      if (before === 'pause' && mood === 'menu' && track !== null && voice === track) {
        // Quitting a run from its pause: the set is already out, the recording starts over on its opening.
        menuAt = null;
        track.rewind();
      } else {
        menuAt = music.menuAt(context.currentTime);
      }
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

  // Menus already waiting for it hear each part at once; the ambience when its opening or loop does
  // not decode.
  const takeMenus = (opened: Running, part: RecordingPartName, buffer: AudioBuffer | null) => {
    const voice = trackOf(opened);
    if (running !== opened || voice === null) {
      return;
    }
    if (buffer !== null) {
      voice.take(buffer, part);
    } else if (part !== 'intro') {
      voice.leave();
      opened.dropped = voice;
      opened.menus = 'ambience';
      if (heard !== 'set' && menuAt === null) {
        opened.ambience.enter(opened.context.currentTime);
      }
    }
    stopPumping ??= repeat(pump);
  };

  const open = (): Running => {
    const context = (options.createContext ?? (() => new AudioContext()))();
    const master = createMasterChain(context, muted, volume, options.stems === true);
    const samples = (options.samples ?? placedSamples)(context);
    const sfx = createSfx(master.sfx, trapEffectOf, options.sfxLookups, track, samples);
    sfx.setHitSound(hitSound);
    const opened: Running = {
      context,
      master,
      music: (FULL_MUSIC.festival ?? createMusic)(
        master.music,
        {
          track,
          breakBars,
          setOf: options.setOf,
          onKickScheduled: options.onKickScheduled,
          loops: { files: FULL_SOUNDS.music ?? {} },
        },
        options.trackFor,
      ),
      sfx,
      samples,
      ambience: createAmbience(master.music),
      menus:
        options.menuTrack === undefined
          ? 'ambience'
          : createRecordingVoice(master.music, MENU_RECORDING),
      dropped: null,
    };
    const load = options.menuTrack?.(context);
    for (const part of ['intro', 'opening', 'loop'] as const) {
      void load?.[part]?.then((buffer) => {
        takeMenus(opened, part, buffer);
      });
    }
    return opened;
  };

  // Plays sim events outside any game, each `after` seconds on: the Programme's « Listen ».
  const playTake = (take: SpecialTake, players?: Parameters<Sfx['play']>[2]): void => {
    if (running === null || isRealtimeStalled(running.context)) {
      return;
    }
    const { context, sfx } = running;
    const now = context.currentTime;
    for (const { after, event } of take) {
      sfx.beginFrame();
      sfx.play([event], now + after, players);
    }
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
        state.tick,
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
    playSpecial(classId) {
      const kind = options.sfxLookups?.skillKindOf?.(classId);
      if (kind !== undefined) {
        const [take = []] = specialTakes(kind);
        playTake(take, [{ id: 0, classId }]);
      }
    },
    hear(take) {
      playTake(take);
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
    loaded() {
      return running === null
        ? Promise.resolve()
        : Promise.all([running.music.loaded(), running.samples.loaded]).then(() => undefined);
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
      if (now === null) {
        return null;
      }
      const voice = menuVoice(running);
      const beats = voice.position(now);
      const heardMusic: MenuHeard['music'] = voice === running.ambience ? 'ambience' : 'track';
      return beats === null ? null : { music: heardMusic, beats };
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
