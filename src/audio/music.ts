import { MAIN_STAGE } from '../data/main-stage';
import type { MusicTrack, SetDefinition } from '../data/types';
import { MAIN_TEMPO, type Tempo } from '../shared/tempo';
import type { ReplayBeats } from '../sim/commands';
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
  replayedBeats,
  resumeLine,
  resumedOnBeat,
  shiftedClock,
  type ResumeLine,
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
  DANGER_SMOOTHING,
  OPEN_CUTOFFS,
  OPEN_HZ,
  PULSE,
  dangerCutoffs,
  diveCutoff,
  dropTickOf,
  entersSegment,
  latched,
  modeOf,
  momentAfter,
  type DangerCutoffs,
  type MusicMode,
} from './music-score';
import { CUT_SECONDS, playStep, sustain, type Groove } from './music-step';
import type { Acoustics } from './reverb';
import type { SoundFiles } from './sound-file';
import { trackDanger } from './track-danger';
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
  // By track id, the danger curves the artists set; absent, every track plays the default.
  dangers?: SoundFiles['dangers'] | undefined;
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
  // game resumes on, the one the beats it plays again land on, set on the first call, a sixteenth
  // after `now` at least. Null when no choice waits.
  resumeOnBeat(now: number, currentTime: number): number | null;
  // While a choice holds a bar with no resume set: the beats of that bar the game would play again
  // if the cards were answered `now`, from the loop's next beat line; else none.
  replayBeatsAt(now: number, currentTime: number): ReplayBeats;
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

interface Danger {
  // Where the music goes in: through its high-pass, then its low-pass.
  input: AudioNode;
  // Follows the cutoffs, or takes them at once.
  follow(cutoffs: DangerCutoffs, currentTime: number, atOnce: boolean): void;
  // A loss: the music sweeps down from where the danger left it, its bass given back.
  extinguish(at: number): void;
}

function createDanger(out: AudioNode): Danger {
  const context = out.context;
  const highPass = context.createBiquadFilter();
  highPass.type = 'highpass';
  const lowPass = context.createBiquadFilter();
  lowPass.type = 'lowpass';
  highPass.connect(lowPass);
  lowPass.connect(out);
  const filters = [
    [highPass, 'highPass'],
    [lowPass, 'lowPass'],
  ] as const;
  for (const [filter, name] of filters) {
    filter.frequency.value = OPEN_CUTOFFS[name];
  }
  let heard: DangerCutoffs = OPEN_CUTOFFS;
  return {
    input: highPass,
    follow(cutoffs, currentTime, atOnce) {
      for (const [filter, name] of filters) {
        if (atOnce) {
          filter.frequency.cancelScheduledValues(currentTime);
          filter.frequency.setValueAtTime(cutoffs[name], currentTime);
        } else if (cutoffs[name] !== heard[name]) {
          filter.frequency.setTargetAtTime(cutoffs[name], currentTime, DANGER_SMOOTHING);
        }
      }
      heard = cutoffs;
    },
    extinguish(at) {
      highPass.frequency.cancelScheduledValues(at);
      highPass.frequency.setTargetAtTime(OPEN_CUTOFFS.highPass, at, EXTINCTION_SECONDS / 4);
      extinguish(lowPass, at);
    },
  };
}

function lifeOf({ core }: SimState): number {
  return core.maxHp > 0 ? core.hp / core.maxHp : 1;
}

export function createMusic(out: AudioNode, options: MusicOptions): Music {
  const context = out.context;
  const level = context.createGain();
  // The music thins through it as the stage nears silence; what plays on a bus's whole goes around.
  const danger = createDanger(level);
  const deck = createLoopDeck(danger.input, options.loops ?? { files: {} });
  const hits = options.hits ?? musicHits();
  const groove: Groove = {
    track: options.track,
    tempo: MAIN_TEMPO,
    tier: 0,
    dropTick: null,
    pulsing: false,
    choking: false,
    heartbeatFrom: null,
    heartbeat: () => deck.heartbeat(),
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
  const room = createRoom(danger.input);
  // The room of what goes around the danger filters.
  const wholeRoom = createRoom(level);
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
  // The resume line a pick read its beats off, for the hold it was read in.
  let offered: { readonly hold: HeldBar; readonly line: ResumeLine } | null = null;
  let firstPass: Bus | null = null;
  // What the danger filters last followed.
  const dangerFollowed = { life: Number.NaN, trackId: '' };
  // A track's files decode from its first update, unless a game set it before.
  let requested = false;

  function load(track: MusicTrack) {
    requested = true;
    deck.load(track);
  }

  function openBus(): Bus {
    const opened = createBus(
      { music: danger.input, level },
      groove.track.echo,
      3 * sixteenthSeconds(groove.tempo),
    );
    room.send(opened.output, acoustics);
    wholeRoom.send(opened.whole, acoustics);
    bus = opened;
    return opened;
  }

  function followSet(state: SimState) {
    if (state.setId === setId) {
      followReplay(state);
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
    groove.heartbeatFrom = null;
    groove.tempo = next;
    acoustics = set?.acoustics;
    stage = set ?? MAIN_STAGE;
  }

  // A card choice that made the game play beats again moved its grid: the music goes on on it, and the
  // heartbeat loop where it was in the music.
  function followReplay(state: SimState) {
    const next = playedTempo(stage, state);
    if (next.originTick === groove.tempo.originTick) {
      return;
    }
    const moved = next.originTick - groove.tempo.originTick;
    if (groove.heartbeatFrom !== null) {
      groove.heartbeatFrom += moved;
    }
    groove.tempo = next;
  }

  function followMode(state: SimState, currentTime: number) {
    const next = modeOf(state.status);
    if (next === mode) {
      return;
    }
    mode = next;
    anchor = null;
    segment = null;
    groove.heartbeatFrom = null;
    if (next === 'won') {
      retireBus(bus, WON_FADE_SECONDS);
      deck.retire(currentTime, WON_FADE_SECONDS);
      endsAt = hits.play('sunrise', openBus().whole, currentTime, groove.track);
    } else if (next === 'lost') {
      danger.extinguish(currentTime);
      retireBus(bus, EXTINCTION_SECONDS);
      deck.extinguish(currentTime);
      endsAt = hits.play('powerDown', openBus().whole, currentTime, groove.track);
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

  function followLife(state: SimState, currentTime: number, atOnce: boolean) {
    const life = lifeOf(state);
    groove.pulsing = latched(groove.pulsing, life, PULSE);
    groove.choking = latched(groove.choking, life, CHOKE);
    if (!atOnce && life === dangerFollowed.life && groove.track.id === dangerFollowed.trackId) {
      return;
    }
    dangerFollowed.life = life;
    dangerFollowed.trackId = groove.track.id;
    const { curve } = trackDanger(groove.track.id, options.dangers);
    danger.follow(dangerCutoffs(curve, life), currentTime, atOnce);
  }

  function reopenBus(
    state: SimState,
    followed: Follow,
    currentTime: number,
    entering: SetSegment | null,
  ): Bus {
    const clock = followed.anchor;
    retireBus(bus, CUT_SECONDS);
    const target = openBus();
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
    offered = null;
    retireBus(firstPass, CUT_SECONDS);
    firstPass = null;
  }

  // The bar the tick stopped in plays out on its bus, then loops whole on a bus of its own: what the
  // lookahead scheduled of the next bar fades out with the first.
  function holdBar(target: Bus, state: SimState, clock: Anchor, currentTime: number): Bus {
    const held = heldBarOf(state.tick, groove.tempo, groove.dropTick);
    hold = held;
    const end = tickToTime(clock, held.untilTick);
    scheduleAhead(target, state, clock, currentTime, end);
    cursor = held.untilTick;
    retireBus(target, CUT_SECONDS, end - CUT_SECONDS);
    firstPass = target;
    return openBus();
  }

  function followSpeakers(state: SimState) {
    const speakers = state.speakers ?? [];
    groove.plugging = pluggingSpeakers(speakers, stage.speakers ?? [], groove.tempo.ticksPerBar);
    groove.entries = speakerEntries(groove.entries, speakers, state.tick, cursor, groove.tempo);
  }

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
    if (hold === null || !inPass(hold, step)) {
      playStep(groove, target, step - back, state, passClock, currentTime, sound - back);
      return;
    }
    // A pass sounds on the grid and the drop the choice opened on, which a replay moved since; the
    // heartbeat loop it places goes on where the music is.
    const moved = groove.tempo.originTick - hold.tempo.originTick;
    const pass: Groove = {
      ...groove,
      tempo: hold.tempo,
      dropTick: hold.dropTick,
      heartbeatFrom: groove.heartbeatFrom === null ? null : groove.heartbeatFrom - moved,
    };
    playStep(pass, target, step - back, state, passClock, currentTime, sound - back);
    groove.heartbeatFrom = pass.heartbeatFrom === null ? null : pass.heartbeatFrom + moved;
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
      if (next.id !== groove.track.id) {
        groove.heartbeatFrom = null;
      }
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
      // The clock moves back by the beats from the end of the held bar's first pass to the line the
      // game's replay lands on, so that its next tick sounds there: the passes fill the time before,
      // and the track goes on from the loop's beat on a bus of its own, the loop's bus retired on the
      // line with what the lookahead had scheduled past it.
      // The line the pick read its beats off, while it can still be cut on: a lead that passed since
      // would put the game's beat a bar later.
      const beats = replayedBeats(hold, groove.tempo);
      const line =
        offered?.hold === hold &&
        offered.line.beats === beats &&
        offered.line.at >= currentTime + 2 * CUT_SECONDS
          ? offered.line
          : undefined;
      const resumed = resumedOnBeat(hold, anchor, { now, currentTime }, beats, line);
      hold = resumed;
      const at = resumed.resumesAt ?? currentTime;
      anchor = shiftedClock(anchor, resumed.clockShift);
      cursor = Math.min(cursor - resumed.clockShift, resumed.untilTick);
      retireBus(bus, CUT_SECONDS, at - CUT_SECONDS);
      // A resync before the line silences the loop at once, as it does a first pass.
      firstPass = bus;
      openBus();
      // Open on the line: the game goes on with the loop's next beat sounding clear.
      dive.to('running', currentTime, groove.tempo, at);
      return at;
    },
    replayBeatsAt(now, currentTime) {
      if (hold === null || anchor === null || hold.resumesAt !== null) {
        return 0;
      }
      offered = { hold, line: resumeLine(hold, anchor, { now, currentTime }) };
      return offered.line.beats;
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
      // A run that starts, or a clock that moved, takes the filters where its life is at once: the
      // music lives on from a lost run.
      followLife(state, currentTime, followed.resynced);
      let target = bus;
      if (followed.resynced) {
        // A pause or a hidden tab moved the clock: a choice holds its bar again from the tick.
        releaseHold();
      }
      if (target === null || followed.resynced || entered) {
        const entering = entered && previous !== null ? state.set.segment : null;
        target = reopenBus(state, followed, currentTime, entering);
      }
      if (resumedFrom !== null && followed.resynced) {
        // A frame that comes a step after the game resumed still plays the step it stopped on.
        const { tempo } = groove;
        const stopped = firstStepAtOrAfter(resumedFrom, sixteenthTicks(tempo), tempo.originTick);
        cursor = Math.min(cursor, stopped);
      }
      if (hold === null && state.status === 'choosingUpgrade') {
        target = holdBar(target, state, clock, currentTime);
      }
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
