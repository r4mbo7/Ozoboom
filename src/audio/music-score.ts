import type { MusicPart, MusicTrack, SetDefinition } from '../data/types';
import { wrap } from '../shared/scalar';
import {
  BARS_PER_PHRASE,
  MAIN_TEMPO,
  barOfTick,
  isBarTick,
  phraseOfTick,
  type Tempo,
} from '../shared/tempo';
import type { GameStatus, SetProgress, SetSegment, SimState } from '../sim/state';
import type { DangerCurve, DangerFilter } from './sound-file';
import { MIN_DROP_BARS, bossLeft, dropEndTick, isLastTier } from '../sim/systems/set-progress';
import { SPEAKER_LAYER_IDS, type SpeakerLayerId } from './speaker-layers';

export type MusicMode = 'playing' | 'won' | 'lost';

export interface Layers {
  kick: boolean;
  bass: boolean;
  hats: boolean;
  hats16: boolean;
  clap: boolean;
  pad: boolean;
  texture: boolean;
  arp: boolean;
  lead: boolean;
  squelch: boolean;
  theme: boolean;
  speakers: readonly SpeakerLayerId[];
  leadCutoff: number;
  bassCutoff: number;
}

export interface BreakCue {
  roll: number | null;
  cut: boolean;
}

export interface Threshold {
  below: number;
  offAt: number;
}

const THEME_TIER = 1;
const ROLL_BARS = 3;
export const PULSE: Threshold = { below: 0.25, offAt: 0.27 };
export const CHOKE: Threshold = { below: 0.1, offAt: 0.12 };
// Seconds, the time constant of a cutoff following the life of the core.
export const DANGER_SMOOTHING = 0.12;
const PAD_HZ = 900;
export const NO_CUE: BreakCue = { roll: null, cut: false };
export const OPEN_HZ = 20_000;
const HIGH_PASS_OPEN_HZ = 20;
const DIVE_HZ = 900;

export function latched(on: boolean, life: number, threshold: Threshold): boolean {
  return life < (on ? threshold.offAt : threshold.below);
}

export const PULSE_SIXTEENTH = 2;
// The gain of the heartbeat's loudest hit.
export const PULSE_GAIN = 0.55;

export function pulseGain(sixteenth: number, pulse: boolean, choke: boolean): number {
  if (!pulse || (sixteenth >= 8 && !choke)) {
    return 0;
  }
  switch (sixteenth % 8) {
    case PULSE_SIXTEENTH:
      return PULSE_GAIN;
    case PULSE_SIXTEENTH + 1:
      return 0.4;
    default:
      return 0;
  }
}

export function isPulseEcho(sixteenth: number): boolean {
  return sixteenth % 8 === PULSE_SIXTEENTH + 1;
}

export const HEARTBEAT_BARS = 2;

// The bar line a track's heartbeat loop entered on, as the step at `step` leaves it: each bar line
// decides from the heartbeat whether the loop plays through its bar, from its start when it enters.
export function heartbeatLoopFrom(
  from: number | null,
  step: number,
  pulsing: boolean,
  tempo: Tempo = MAIN_TEMPO,
): number | null {
  if (!isBarTick(step, tempo)) {
    return from;
  }
  return pulsing ? (from ?? step) : null;
}

export function heartbeatLoopTicks(step: number, from: number, tempo: Tempo = MAIN_TEMPO): number {
  return wrap(step - from, HEARTBEAT_BARS * tempo.ticksPerBar);
}

export const DEFAULT_DANGER: DangerCurve = {
  highPass: { from: { percent: 25, hz: HIGH_PASS_OPEN_HZ }, to: { percent: 10, hz: 150 } },
  lowPass: { from: { percent: 10, hz: OPEN_HZ }, to: { percent: 0, hz: 380 } },
};

export interface DangerCutoffs {
  readonly highPass: number;
  readonly lowPass: number;
}

export const OPEN_CUTOFFS: DangerCutoffs = { highPass: HIGH_PASS_OPEN_HZ, lowPass: OPEN_HZ };

// Open above its first point, held at its second below it, by as many octaves each point between.
function filterCutoff({ from, to }: DangerFilter, percent: number, open: number): number {
  if (percent >= from.percent) {
    return open;
  }
  const along = Math.min(1, (from.percent - percent) / (from.percent - to.percent));
  return from.hz * (to.hz / from.hz) ** along;
}

export function dangerCutoffs(curve: DangerCurve, life: number): DangerCutoffs {
  const percent = 100 * life;
  return {
    highPass: filterCutoff(curve.highPass, percent, HIGH_PASS_OPEN_HZ),
    lowPass: filterCutoff(curve.lowPass, percent, OPEN_HZ),
  };
}

// Shallower than the choke and resonant: a filter sweep, not a scene that dies.
export function diveCutoff(status: GameStatus): number {
  return status === 'choosingUpgrade' ? DIVE_HZ : OPEN_HZ;
}

export function modeOf(status: GameStatus): MusicMode {
  if (status === 'won' || status === 'lost') {
    return status;
  }
  return 'playing';
}

export function phraseAt(
  progress: SetProgress,
  fromTick: number,
  tick: number,
  tempo: Tempo = MAIN_TEMPO,
): number {
  return progress.phrase + phraseOfTick(tick, tempo) - phraseOfTick(fromTick, tempo);
}

// The tick a segment's music starts on: the beats a card choice made it play again come after it.
export function segmentMusicStart(
  progress: Pick<SetProgress, 'segmentStartTick' | 'segmentReplayTicks'>,
): number {
  return progress.segmentStartTick + (progress.segmentReplayTicks ?? 0);
}

export function dropTickOf(
  progress: SetProgress,
  breakBars: number,
  tempo: Tempo = MAIN_TEMPO,
): number | null {
  return progress.segment === 'break'
    ? segmentMusicStart(progress) + breakBars * tempo.ticksPerBar
    : null;
}

// A segment of a tier, from the tick it starts on.
export type SetMoment = Pick<SetProgress, 'tier' | 'segment' | 'segmentStartTick'>;

// The bars of its tier before a moment starts, as the stage lasts them: its buildup before its
// break, and its break too before its drop.
export function barsIntoTier(
  { tier, segment }: Pick<SetMoment, 'tier' | 'segment'>,
  stage: SetDefinition,
): number {
  const definition = stage.tiers[tier];
  if (definition === undefined || segment === 'buildup') {
    return 0;
  }
  const buildup = definition.buildupPhrases * BARS_PER_PHRASE;
  return segment === 'break' ? buildup : buildup + definition.breakBars;
}

// The moment the set enters next once its tick is known, as the set's progress decides it: a
// buildup's break after its phrases, a break's drop, and once a drop's last boss has fallen the next
// buildup on the bar line the drop ends on (the last tier's again in an endless run, none after it).
export function momentAfter(
  state: SimState,
  stage: SetDefinition,
  dropTick: number | null,
  tempo: Tempo = MAIN_TEMPO,
): SetMoment | null {
  const { set, tick } = state;
  const { tier, segment } = set;
  const start = segmentMusicStart(set);
  switch (segment) {
    case 'buildup': {
      const phrases = stage.tiers[tier]?.buildupPhrases;
      return phrases === undefined
        ? null
        : {
            tier,
            segment: 'break',
            segmentStartTick: start + phrases * BARS_PER_PHRASE * tempo.ticksPerBar,
          };
    }
    case 'break':
      return dropTick === null ? null : { tier, segment: 'drop', segmentStartTick: dropTick };
    case 'drop': {
      if (bossLeft(state) || isLastTier(set, stage)) {
        return null;
      }
      const nextBar = tempo.originTick + (barOfTick(tick, tempo) + 1) * tempo.ticksPerBar;
      return {
        tier: Math.min(tier + 1, stage.tiers.length - 1),
        segment: 'buildup',
        segmentStartTick:
          dropEndTick(set, tempo) ?? Math.max(nextBar, start + MIN_DROP_BARS * tempo.ticksPerBar),
      };
    }
  }
}

export function segmentAt(segment: SetSegment, dropTick: number | null, tick: number): SetSegment {
  return segment === 'break' && dropTick !== null && tick >= dropTick ? 'drop' : segment;
}

export function breakCueAt(
  dropTick: number | null,
  tick: number,
  tempo: Tempo = MAIN_TEMPO,
): BreakCue {
  const left = dropTick === null ? 0 : dropTick - tick;
  const { ticksPerBeat, ticksPerBar } = tempo;
  const stepTicks = ticksPerBeat / 4;
  if (left <= 0 || left > ROLL_BARS * ticksPerBar) {
    return NO_CUE;
  }
  if (left <= ticksPerBeat) {
    return { roll: null, cut: true };
  }
  if (left <= 2 * ticksPerBeat) {
    return { roll: stepTicks / 2, cut: false };
  }
  if (left <= ticksPerBar) {
    return { roll: stepTicks, cut: false };
  }
  return { roll: left <= 2 * ticksPerBar ? 2 * stepTicks : ticksPerBeat, cut: false };
}

export function rollProgress(ticksBeforeDrop: number, tempo: Tempo): number {
  const { ticksPerBeat, ticksPerBar } = tempo;
  return 1 - (ticksBeforeDrop - ticksPerBeat) / (ROLL_BARS * ticksPerBar - ticksPerBeat);
}

export function entersSegment(
  set: Pick<SetProgress, 'segment' | 'tier' | 'segmentStartTick'>,
  segment: SetSegment | null,
  tier: number,
  dropTick: number | null,
): boolean {
  const countedDown =
    segment === 'break' && set.segment === 'drop' && set.segmentStartTick === dropTick;
  return !countedDown && (set.segment !== segment || set.tier !== tier);
}

export function layersFor(
  segment: SetSegment,
  tier: number,
  phrase: number,
  heard: readonly string[] = [],
): Layers {
  const speakers = SPEAKER_LAYER_IDS.filter((id) => heard.includes(id));
  return { ...segmentLayers(segment, tier, phrase), speakers };
}

function segmentLayers(
  segment: SetSegment,
  tier: number,
  phrase: number,
): Omit<Layers, 'speakers'> {
  switch (segment) {
    case 'buildup':
      return {
        kick: true,
        bass: true,
        hats: true,
        hats16: tier >= 1,
        clap: false,
        pad: phrase >= 1,
        texture: phrase >= 1,
        arp: phrase >= 2,
        lead: phrase >= 3 || tier >= 1,
        squelch: tier >= 1,
        theme: tier >= THEME_TIER,
        leadCutoff: 900 + 700 * tier,
        bassCutoff: 700 + 150 * tier,
      };
    case 'break':
      return {
        kick: false,
        bass: false,
        hats: false,
        hats16: false,
        clap: false,
        pad: true,
        texture: true,
        arp: false,
        lead: true,
        squelch: false,
        theme: true,
        leadCutoff: 1100,
        bassCutoff: 0,
      };
    case 'drop':
      return {
        kick: true,
        bass: true,
        hats: true,
        hats16: true,
        clap: true,
        pad: true,
        texture: true,
        arp: true,
        lead: true,
        squelch: true,
        theme: true,
        leadCutoff: 3200 + 800 * tier,
        bassCutoff: 1000 + 150 * tier,
      };
  }
}

export function partHeard(heard: MusicPart['in'], segment: SetSegment): boolean {
  switch (heard) {
    case 'light':
      return segment === 'break';
    case 'full':
      return segment !== 'break';
    case 'rise':
      return segment === 'buildup';
    case 'drop':
      return segment === 'drop';
    case undefined:
      return true;
  }
}

export function padCutoff(
  track: MusicTrack,
  segment: SetSegment,
  progress: SetProgress,
  bar: number,
  tempo: Tempo = MAIN_TEMPO,
) {
  return segment === 'break'
    ? PAD_HZ + (track.padOpens ?? 0) * (bar - barOfTick(segmentMusicStart(progress), tempo))
    : PAD_HZ;
}
