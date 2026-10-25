import { MAIN_STAGE } from '../data/main-stage';
import type { MusicTrack, SetDefinition, SpeakerDefinition } from '../data/types';
import { MAIN_TEMPO, type Tempo } from '../shared/tempo';
import { playedTempo } from '../sim/lineup';
import type { GameStatus, SetProgress, SetSegment, SimState } from '../sim/state';
import { createBlank, heardBlackout, silentStep, soundingStep } from './blackout';
import {
  LATE_TOLERANCE_SECONDS,
  LOOKAHEAD_SECONDS,
  barSeconds,
  beatSeconds,
  firstStepAtOrAfter,
  follow,
  sixteenthSeconds,
  sixteenthTicks,
  stepsToSchedule,
  tickToTime,
  timeToTick,
  type Anchor,
  type Follow,
} from './clock';
import { createFader } from './fade';
import { createBus, createRoom, retireBus, type Bus } from './music-bus';
import { EXTINCTION_SECONDS, downlifter, impact, powerDown, sunrise } from './music-hits';
import {
  CHOKE,
  OPEN_HZ,
  PULSE,
  diveCutoff,
  dropTickOf,
  entersSegment,
  latched,
  modeOf,
  musicCutoff,
  type MusicMode,
} from './music-score';
import { CUT_SECONDS, playStep, sustain, type Groove } from './music-step';
import type { Acoustics } from './reverb';
import { pluggingSpeakers, speakerEntries } from './speaker-layers';

export interface MusicOptions {
  track: MusicTrack;
  breakBars: (tier: number) => number;
  // Absent means the main stage.
  setOf?: ((setId: string) => SetDefinition | undefined) | undefined;
  onKickScheduled: ((tick: number, time: number) => void) | undefined;
}

export interface Music {
  update(state: SimState, now: number, currentTime: number): void;
  // Now during a game, after the ending once it is over.
  menuAt(currentTime: number): number;
  // Over one bar, in rhythm; returns the next beat of its grid.
  fadeOut(currentTime: number): number;
  // Over one bar, on the grid of the next update.
  fadeIn(): void;
  setTrack(track: MusicTrack): void;
  // The one set, or the one a festival's next stage drew.
  track(): MusicTrack;
  // The main stage's before any set.
  tempo(): Tempo;
  // null when none plays.
  clock(): Anchor | null;
}

interface Dive {
  filter: BiquadFilterNode;
  to(status: GameStatus, at: number, tempo: Tempo): void;
}

const WON_FADE_SECONDS = 1.5;
const CHOKE_SMOOTHING = 0.12;
// In decibels, for a low-pass: the peak that makes the closing heard as a sweep.
const DIVE_Q = 6;
const DIVE_OPEN_SECONDS = 0.01;

function createDive(context: BaseAudioContext): Dive {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = OPEN_HZ;
  filter.Q.value = DIVE_Q;
  let dived = OPEN_HZ;
  return {
    filter,
    to(status, at, tempo) {
      const cutoff = diveCutoff(status);
      if (cutoff !== dived) {
        dived = cutoff;
        filter.frequency.setTargetAtTime(
          cutoff,
          at,
          cutoff < OPEN_HZ ? beatSeconds(tempo) / 4 : DIVE_OPEN_SECONDS,
        );
      }
    },
  };
}

function lifeOf({ core }: SimState): number {
  return core.maxHp > 0 ? core.hp / core.maxHp : 1;
}

function extinguish(bus: Bus | null, at: number) {
  if (bus !== null) {
    bus.input.frequency.setValueAtTime(bus.input.frequency.value, at);
    bus.input.frequency.exponentialRampToValueAtTime(60, at + EXTINCTION_SECONDS);
  }
  retireBus(bus, EXTINCTION_SECONDS);
}

export function createMusic(out: AudioNode, options: MusicOptions): Music {
  const groove: Groove = {
    track: options.track,
    tempo: MAIN_TEMPO,
    tier: 0,
    dropTick: null,
    pulsing: false,
    choking: false,
    entries: new Map(),
    plugging: new Map(),
    onKick: options.onKickScheduled,
  };
  let acoustics: Acoustics | undefined;
  let setId: string | null = null;
  let speakerDefinitions: readonly SpeakerDefinition[] = [];
  const context = out.context;
  const level = context.createGain();
  const fader = createFader(level.gain, context, 1, () => barSeconds(groove.tempo));
  const dive = createDive(context);
  const blank = context.createGain();
  level.connect(blank);
  blank.connect(dive.filter);
  const blackout = createBlank(blank, dive.filter);
  dive.filter.connect(out);
  const room = createRoom(level);
  let bus: Bus | null = null;
  let last: SimState | null = null;
  let endsAt = 0;
  let anchor: Anchor | null = null;
  let cursor = 0;
  let mode: MusicMode | null = null;
  let segment: SetSegment | null = null;
  let followedTick = -1;

  function openBus(cutoff = OPEN_HZ): Bus {
    const opened = createBus(level, cutoff, groove.track.echo, 3 * sixteenthSeconds(groove.tempo));
    room.send(opened.output, acoustics);
    bus = opened;
    return opened;
  }

  function followSet(state: SimState) {
    if (state.setId === setId) {
      return;
    }
    const first = setId === null;
    setId = state.setId;
    const set = options.setOf?.(setId);
    const next = set === undefined ? MAIN_TEMPO : playedTempo(set, state);
    // Another set at another tempo starts its grid where it starts; one at the same tempo goes on as it is.
    if (first || next.ticksPerBeat !== groove.tempo.ticksPerBeat) {
      anchor = null;
      followedTick = -1;
    }
    groove.tempo = next;
    acoustics = set?.acoustics;
    speakerDefinitions = (set ?? MAIN_STAGE).speakers ?? [];
  }

  function followMode(state: SimState, currentTime: number) {
    const next = modeOf(state.status);
    if (next === mode) {
      return;
    }
    mode = next;
    anchor = null;
    segment = null;
    if (next === 'won') {
      retireBus(bus, WON_FADE_SECONDS);
      endsAt = sunrise(openBus().input, currentTime, groove.track);
    } else if (next === 'lost') {
      extinguish(bus, currentTime);
      endsAt = powerDown(openBus().input, currentTime, groove.track);
    }
  }

  function followClock(tick: number, now: number): Follow {
    const followed =
      anchor !== null && tick === followedTick
        ? { anchor, resynced: false }
        : follow(anchor, tick, now);
    anchor = followed.anchor;
    followedTick = tick;
    return followed;
  }

  function followSegment(set: SetProgress): boolean {
    const entered = entersSegment(set, segment, groove.tier, groove.dropTick);
    segment = set.segment;
    groove.tier = set.tier;
    const breakBars = set.segment === 'break' ? options.breakBars(set.tier) : 0;
    groove.dropTick = dropTickOf(set, breakBars, groove.tempo);
    return entered;
  }

  function followLife(state: SimState): number {
    const life = lifeOf(state);
    groove.pulsing = latched(groove.pulsing, life, PULSE);
    groove.choking = latched(groove.choking, life, CHOKE);
    return musicCutoff(groove.choking, life);
  }

  function reopenBus(
    state: SimState,
    followed: Follow,
    currentTime: number,
    cutoff: number,
    entering: SetSegment | null,
  ): Bus {
    const clock = followed.anchor;
    retireBus(bus, CUT_SECONDS);
    const target = openBus(cutoff);
    cursor = firstStepAtOrAfter(
      followed.resynced ? state.tick : Math.max(state.tick, timeToTick(clock, currentTime)),
      sixteenthTicks(groove.tempo),
      groove.tempo.originTick,
    );
    const at = Math.max(tickToTime(clock, state.tick), currentTime);
    if (entering === 'drop') {
      impact(target.input, at);
    } else if (entering === 'break') {
      downlifter(target.input, at, groove.track.build === 'soft');
    }
    sustain(groove, target, state, currentTime, clock);
    return target;
  }

  function followFilter(target: Bus, cutoff: number, currentTime: number) {
    if (cutoff !== target.cutoff) {
      target.input.frequency.setTargetAtTime(cutoff, currentTime, CHOKE_SMOOTHING);
      target.cutoff = cutoff;
    }
  }

  function followSpeakers(state: SimState) {
    const speakers = state.speakers ?? [];
    groove.plugging = pluggingSpeakers(speakers, speakerDefinitions, groove.tempo.ticksPerBar);
    groove.entries = speakerEntries(groove.entries, speakers, state.tick, cursor, groove.tempo);
  }

  function scheduleAhead(target: Bus, state: SimState, clock: Anchor, currentTime: number) {
    const { tempo } = groove;
    const stepTicks = sixteenthTicks(tempo);
    const heard = heardBlackout(state);
    const range = stepsToSchedule(
      clock,
      cursor,
      currentTime - LATE_TOLERANCE_SECONDS,
      currentTime + LOOKAHEAD_SECONDS,
      stepTicks,
      tempo.originTick,
    );
    for (let step = range.from; step < range.until; step += stepTicks) {
      if (!silentStep(heard, step)) {
        const sound = soundingStep(heard, step, tempo.ticksPerBeat);
        playStep(groove, target, step, state, clock, currentTime, sound);
      }
    }
    cursor = range.until;
  }

  return {
    setTrack(next) {
      groove.track = next;
    },
    tempo() {
      return groove.tempo;
    },
    track() {
      return groove.track;
    },
    clock() {
      return anchor;
    },
    update(state, now, currentTime) {
      last = state;
      followSet(state);
      dive.to(state.status, currentTime, groove.tempo);
      followMode(state, currentTime);
      if (mode !== 'playing') {
        return;
      }
      const followed = followClock(state.tick, now);
      const clock = followed.anchor;
      const previous = segment;
      const entered = followSegment(state.set);
      const cutoff = followLife(state);
      let target = bus;
      if (target === null || followed.resynced || entered) {
        const entering = entered && previous !== null ? state.set.segment : null;
        target = reopenBus(state, followed, currentTime, cutoff, entering);
      }
      followFilter(target, cutoff, currentTime);
      followSpeakers(state);
      blackout.follow(state, followed, currentTime);
      scheduleAhead(target, state, clock, currentTime);
    },
    menuAt(currentTime) {
      return mode === 'won' || mode === 'lost' ? Math.max(currentTime, endsAt) : currentTime;
    },
    fadeOut(currentTime) {
      fader.to(0);
      if (mode !== 'playing' || bus === null || anchor === null || last === null) {
        return currentTime;
      }
      const clock = anchor;
      const { tempo } = groove;
      const stepTicks = sixteenthTicks(tempo);
      const range = stepsToSchedule(
        clock,
        cursor,
        currentTime - LATE_TOLERANCE_SECONDS,
        currentTime + barSeconds(tempo),
        stepTicks,
        tempo.originTick,
      );
      const until = Math.min(range.until, groove.dropTick ?? Infinity);
      for (let step = range.from; step < until; step += stepTicks) {
        playStep(groove, bus, step, last, clock, currentTime);
      }
      cursor = Math.max(cursor, until);
      anchor = null;
      const beat = firstStepAtOrAfter(
        timeToTick(clock, currentTime),
        tempo.ticksPerBeat,
        tempo.originTick,
      );
      return Math.max(currentTime, tickToTime(clock, beat));
    },
    fadeIn() {
      fader.to(1);
      anchor = null;
    },
  };
}
