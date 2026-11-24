import { MAIN_STAGE } from '../data/main-stage';
import type { MusicTrack, SetDefinition } from '../data/types';
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
import { createFilterOut } from './filter-out';
import {
  heldBarOf,
  heldShift,
  inPass,
  resumedOnBeat,
  shiftedClock,
  type HeldBar,
} from './held-bar';
import { createBus, createRoom, retireBus, setEcho, type Bus } from './music-bus';
import { createLoopDeck, type LoopFiles } from './loop-deck';
import {
  EXTINCTION_SECONDS,
  SOFT_DOWNLIFTER_GAIN,
  extinguish,
  musicHits,
  type MusicHits,
} from './music-hits';
import {
  CHOKE,
  CHOKE_SMOOTHING,
  OPEN_HZ,
  PULSE,
  diveCutoff,
  dropTickOf,
  entersSegment,
  latched,
  modeOf,
  momentAfter,
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
  // The artists' loops of the stage tracks; absent, the sequencer plays every moment.
  loops?: LoopFiles | undefined;
  // The game's own sounds, files and silences of the artist (ADR 0027); absent, their synth voices.
  hits?: MusicHits | undefined;
}

export interface Music {
  update(state: SimState, now: number, currentTime: number): void;
  // Now during a game, after the ending once it is over.
  menuAt(currentTime: number): number;
  // Over one bar, in rhythm; returns the next beat of its grid.
  fadeOut(currentTime: number): number;
  // Over one bar, on the grid of the next update.
  fadeIn(): void;
  // The entry a run opens on: `tick` lands at `at`, the level at full at once. Until a later tick,
  // the clock anchors that tick there whenever it starts again; a fade out before `at` drops it, and
  // nothing of that tick sounds.
  landAt(tick: number, at: number): void;
  // Set again, the same track tries again the files that failed to load.
  setTrack(track: MusicTrack): void;
  // The one set, or the one a festival's next stage drew.
  track(): MusicTrack;
  // The main stage's before any set.
  tempo(): Tempo;
  // null when none plays.
  clock(): Anchor | null;
  // Settles once the loops of the playing track have decoded or failed.
  loaded(): Promise<void>;
  // Once the cards of a choice are answered, before the game moves on: the beat line of the loop the
  // game resumes on, set on the first call, a sixteenth after `now` at least. Null when no choice
  // waits.
  resumeOnBeat(now: number, currentTime: number): number | null;
  // A choice holds a bar: its cards are open, or answered and the game has not moved on.
  holdsBar(): boolean;
}

interface Dive {
  filter: BiquadFilterNode;
  // An opening lasts a beat, or until `openAt`.
  to(status: GameStatus, at: number, tempo: Tempo, openAt?: number): void;
}

// The dive's cutoff from `at`: a closing nears `to` with `seconds` as its time constant, an opening
// rises to it in `seconds`, by as many octaves each moment.
interface Sweep {
  readonly at: number;
  readonly from: number;
  readonly to: number;
  readonly seconds: number;
}

const WON_FADE_SECONDS = 1.5;
// In decibels, for a low-pass: the peak that makes the closing heard as a sweep.
const DIVE_Q = 6;

function sweepAt({ at, from, to, seconds }: Sweep, time: number): number {
  const elapsed = Math.max(0, time - at);
  return to < from
    ? to + (from - to) * Math.exp(-elapsed / seconds)
    : from * (to / from) ** Math.min(1, elapsed / seconds);
}

// Each change starts from where the cutoff is, so a choice opening while it reopens closes from there.
function createDive(context: BaseAudioContext): Dive {
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = OPEN_HZ;
  filter.Q.value = DIVE_Q;
  let sweep: Sweep = { at: 0, from: OPEN_HZ, to: OPEN_HZ, seconds: 1 };
  return {
    filter,
    to(status, at, tempo, openAt) {
      const cutoff = diveCutoff(status);
      if (cutoff === sweep.to) {
        return;
      }
      const from = sweepAt(sweep, at);
      const closing = cutoff < from;
      const opening = openAt === undefined ? beatSeconds(tempo) : Math.max(openAt - at, 0.001);
      sweep = { at, from, to: cutoff, seconds: closing ? beatSeconds(tempo) / 4 : opening };
      filter.frequency.cancelScheduledValues(at);
      filter.frequency.setValueAtTime(from, at);
      if (closing) {
        filter.frequency.setTargetAtTime(cutoff, at, sweep.seconds);
      } else {
        filter.frequency.exponentialRampToValueAtTime(cutoff, at + sweep.seconds);
      }
    },
  };
}

function lifeOf({ core }: SimState): number {
  return core.maxHp > 0 ? core.hp / core.maxHp : 1;
}

function extinguishBus(bus: Bus | null, at: number) {
  if (bus !== null) {
    extinguish(bus.input, at);
  }
  retireBus(bus, EXTINCTION_SECONDS);
}

export function createMusic(out: AudioNode, options: MusicOptions): Music {
  const context = out.context;
  const level = context.createGain();
  const deck = createLoopDeck(level, options.loops ?? { files: {} });
  const hits = options.hits ?? musicHits();
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
    hits,
    recorded: (segment) => deck.holds(heardTier(groove.tier), segment),
    stemmed: (speaker, tick, at) => deck.stemAt(speaker, tick, at),
  };
  let acoustics: Acoustics | undefined;
  let setId: string | null = null;
  let stage: SetDefinition = MAIN_STAGE;
  // The last boss down takes the tier past the stage's last one: the files play its drop on.
  const heardTier = (tier: number) => Math.min(tier, stage.tiers.length - 1);
  const fader = createFader(level.gain, context, 1, () => barSeconds(groove.tempo));
  const dive = createDive(context);
  const blank = context.createGain();
  level.connect(blank);
  blank.connect(dive.filter);
  const blackout = createBlank(blank, dive.filter);
  const filterOut = createFilterOut(context);
  dive.filter.connect(filterOut.filter);
  filterOut.filter.connect(out);
  const room = createRoom(level);
  let bus: Bus | null = null;
  let last: SimState | null = null;
  let endsAt = 0;
  let anchor: Anchor | null = null;
  let landing: Anchor | null = null;
  let cursor = 0;
  let mode: MusicMode | null = null;
  let segment: SetSegment | null = null;
  let followedTick = -1;
  // The bar an upgrade choice loops, and the bus its first pass plays out on.
  let hold: HeldBar | null = null;
  let firstPass: Bus | null = null;
  // A track's files decode from its first update, unless a game set it before.
  let requested = false;

  function load(track: MusicTrack) {
    requested = true;
    deck.load(track);
  }

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
    stage = set ?? MAIN_STAGE;
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
      deck.retire(currentTime, WON_FADE_SECONDS);
      endsAt = hits.play('sunrise', openBus().input, currentTime, groove.track);
    } else if (next === 'lost') {
      extinguishBus(bus, currentTime);
      deck.extinguish(currentTime);
      endsAt = hits.play('powerDown', openBus().input, currentTime, groove.track);
    }
  }

  function followClock(tick: number, now: number): Follow {
    if (landing !== null && tick > landing.tick) {
      landing = null;
    }
    const followed =
      anchor !== null && (tick === followedTick || landing !== null)
        ? { anchor, resynced: false }
        : landing === null
          ? follow(anchor, tick, now)
          : { anchor: landing, resynced: true };
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
    // A segment's first step on its bar line plays late by the output latency rather than not at all.
    cursor = firstStepAtOrAfter(state.tick, sixteenthTicks(groove.tempo), groove.tempo.originTick);
    const at = Math.max(tickToTime(clock, state.tick), currentTime);
    const { track } = groove;
    if (entering === 'drop') {
      hits.play('impact', target.input, at, track);
    } else if (entering === 'break') {
      hits.play(
        'downlifter',
        target.input,
        at,
        track,
        track.build === 'soft' ? SOFT_DOWNLIFTER_GAIN : 1,
      );
    }
    sustain(groove, target, state, currentTime, clock);
    return target;
  }

  // A choice holds a bar the game has set no resume line for yet.
  function holdsUnplanned(): boolean {
    return hold !== null && hold.resumesAt === null;
  }

  function releaseHold() {
    hold = null;
    retireBus(firstPass, CUT_SECONDS);
    firstPass = null;
  }

  // The bar the tick stopped in plays out on its bus, then loops on a bus of its own: what the
  // lookahead scheduled of the next bar fades out with the first.
  function holdBar(
    target: Bus,
    state: SimState,
    clock: Anchor,
    currentTime: number,
    cutoff: number,
  ): Bus {
    const held = heldBarOf(state.tick, groove.tempo, groove.dropTick);
    hold = held;
    const end = tickToTime(clock, held.untilTick);
    scheduleAhead(target, state, clock, currentTime, end);
    cursor = held.untilTick;
    retireBus(target, CUT_SECONDS, end - CUT_SECONDS);
    firstPass = target;
    return openBus(cutoff);
  }

  function followFilter(target: Bus, cutoff: number, currentTime: number) {
    if (cutoff !== target.cutoff) {
      target.input.frequency.setTargetAtTime(cutoff, currentTime, CHOKE_SMOOTHING);
      target.cutoff = cutoff;
    }
  }

  function followSpeakers(state: SimState) {
    const speakers = state.speakers ?? [];
    groove.plugging = pluggingSpeakers(speakers, stage.speakers ?? [], groove.tempo.ticksPerBar);
    groove.entries = speakerEntries(groove.entries, speakers, state.tick, cursor, groove.tempo);
  }

  // Past the bar an upgrade choice holds, a step replays the step of that bar it falls on.
  function playHeld(
    target: Bus,
    step: number,
    sound: number,
    state: SimState,
    clock: Anchor,
    currentTime: number,
  ) {
    const back = heldShift(hold, step);
    if (inPass(hold, step) && step - back === hold?.fromTick && hold.cutTick !== null) {
      // Each pass of a break's last bar opens again the echo its silent beat closed.
      setEcho(target, tickToTime(clock, step), true);
    }
    const passClock = shiftedClock(clock, back);
    playStep(groove, target, step - back, state, passClock, currentTime, sound - back);
  }

  function scheduleAhead(
    target: Bus,
    state: SimState,
    clock: Anchor,
    currentTime: number,
    horizon = currentTime + LOOKAHEAD_SECONDS,
  ) {
    const { tempo } = groove;
    const stepTicks = sixteenthTicks(tempo);
    const heard = heardBlackout(state);
    const range = stepsToSchedule(
      clock,
      cursor,
      currentTime - LATE_TOLERANCE_SECONDS,
      horizon,
      stepTicks,
      tempo.originTick,
    );
    for (let step = range.from; step < range.until; step += stepTicks) {
      if (!silentStep(heard, step)) {
        const sound = soundingStep(heard, step, tempo.ticksPerBeat);
        playHeld(target, step, sound, state, clock, currentTime);
      }
    }
    cursor = range.until;
  }

  // The steps left to the bar the fade lasts; the beat the music falls silent on.
  function scheduleFade(currentTime: number): number {
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
    // A held bar never reaches the drop, until the game resumes on its line.
    const dropTick = holdsUnplanned() ? null : groove.dropTick;
    const until = Math.min(range.until, dropTick ?? Infinity);
    for (let step = range.from; step < until; step += stepTicks) {
      playHeld(bus, step, step, last, clock, currentTime);
    }
    cursor = Math.max(cursor, until);
    anchor = null;
    const beat = firstStepAtOrAfter(
      timeToTick(clock, currentTime),
      tempo.ticksPerBeat,
      tempo.originTick,
    );
    return Math.max(currentTime, tickToTime(clock, beat));
  }

  return {
    setTrack(next) {
      groove.track = next;
      load(next);
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
    loaded() {
      return deck.loaded();
    },
    holdsBar() {
      return hold !== null;
    },
    resumeOnBeat(now, currentTime) {
      if (hold === null || anchor === null || bus === null) {
        return null;
      }
      if (hold.resumesAt !== null) {
        return hold.resumesAt;
      }
      if (last?.status !== 'running' || last.tick !== hold.tick) {
        return null;
      }
      // The clock moves by whole beats so that the end of the held bar falls on the line: its passes
      // fill the beats before, and the track goes on from its end on a bus of its own, the loop's bus
      // retired on the line with what the lookahead had scheduled past it.
      hold = resumedOnBeat(hold, anchor, { now, currentTime }, groove.tempo);
      const at = hold.resumesAt ?? currentTime;
      anchor = shiftedClock(anchor, hold.clockShift);
      cursor = Math.min(cursor - hold.clockShift, hold.untilTick);
      const { cutoff } = bus;
      retireBus(bus, CUT_SECONDS, at - CUT_SECONDS);
      // A resync before the line silences the loop at once, as it does a first pass.
      firstPass = bus;
      openBus(cutoff);
      const filterOpenAt = Math.max(at, currentTime + beatSeconds(groove.tempo));
      dive.to('running', currentTime, groove.tempo, filterOpenAt);
      return at;
    },
    update(state, now, currentTime) {
      last = state;
      if (!requested) {
        load(groove.track);
      }
      followSet(state);
      // Its cards answered, a choice holds its bar until the game moves on: on the beat the game
      // asked for, or at once.
      const waiting = state.status === 'running' && state.tick === hold?.tick;
      const unplanned = holdsUnplanned();
      dive.to(waiting && unplanned ? 'choosingUpgrade' : state.status, currentTime, groove.tempo);
      const released = hold !== null && state.status !== 'choosingUpgrade' && !waiting;
      const resumedFrom = released && unplanned ? (hold?.tick ?? null) : null;
      if (released) {
        // The game goes on from the tick it stopped on, or ends there: on the clock the resume set,
        // or where it is now.
        releaseHold();
        if (resumedFrom !== null) {
          anchor = null;
        }
      }
      followMode(state, currentTime);
      if (mode !== 'playing') {
        filterOut.open(currentTime);
        return;
      }
      const followed = followClock(state.tick, now);
      const clock = followed.anchor;
      const previous = segment;
      const entered = followSegment(state.set);
      const cutoff = followLife(state);
      let target = bus;
      if (followed.resynced) {
        // A pause or a hidden tab moved the clock: a choice holds its bar again from the tick.
        releaseHold();
      }
      if (target === null || followed.resynced || entered) {
        const entering = entered && previous !== null ? state.set.segment : null;
        target = reopenBus(state, followed, currentTime, cutoff, entering);
      }
      if (resumedFrom !== null && followed.resynced) {
        // A frame that comes a step after the game resumed still plays the step it stopped on.
        const { tempo } = groove;
        const stopped = firstStepAtOrAfter(resumedFrom, sixteenthTicks(tempo), tempo.originTick);
        cursor = Math.min(cursor, stopped);
      }
      if (hold === null && state.status === 'choosingUpgrade') {
        target = holdBar(target, state, clock, currentTime, cutoff);
      }
      followFilter(target, cutoff, currentTime);
      followSpeakers(state);
      deck.follow({
        set: { ...state.set, tier: heardTier(state.set.tier) },
        // Frozen ticks, as during an upgrade choice, would let the time of a moment ahead pass.
        ahead:
          state.status === 'running' && !holdsUnplanned()
            ? momentAfter(state, stage, groove.dropTick, groove.tempo)
            : null,
        tick: state.tick,
        followed,
        cutoff,
        tempo: groove.tempo,
        stage,
        currentTime,
        entries: groove.entries,
        plugging: groove.plugging,
        cursor,
        hold,
      });
      blackout.follow(state, followed, currentTime);
      filterOut.follow(state, clock, groove.tempo, currentTime);
      scheduleAhead(target, state, clock, currentTime);
    },
    menuAt(currentTime) {
      return mode === 'won' || mode === 'lost' ? Math.max(currentTime, endsAt) : currentTime;
    },
    fadeOut(currentTime) {
      if (landing !== null && currentTime < landing.time) {
        landing = null;
        anchor = null;
        retireBus(bus, CUT_SECONDS);
        bus = null;
        deck.stop(currentTime);
        fader.to(0, 0);
        return currentTime;
      }
      const silent = fader.to(0);
      // The steps of the fade still hear the stems that play under it.
      const until = scheduleFade(currentTime);
      deck.stop(silent);
      return until;
    },
    fadeIn() {
      fader.to(1);
      anchor = null;
    },
    landAt(tick, at) {
      landing = { tick, time: at };
      anchor = null;
      fader.to(1, 0);
    },
  };
}
