import type { MusicPart, MusicTrack } from '../data/types';
import { MAIN_TEMPO, barOfTick, phraseOfTick, type Tempo } from '../shared/tempo';
import type { GameStatus, SetProgress, SetSegment } from '../sim/state';
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
const PAD_HZ = 900;
export const NO_CUE: BreakCue = { roll: null, cut: false };
export const OPEN_HZ = 20_000;
const CHOKED_HZ = 380;
const CHOKE_TOP_HZ = 3000;
const DIVE_HZ = 900;

export function latched(on: boolean, life: number, threshold: Threshold): boolean {
  return life < (on ? threshold.offAt : threshold.below);
}

export function pulseGain(sixteenth: number, pulse: boolean, choke: boolean): number {
  if (!pulse || (sixteenth >= 8 && !choke)) {
    return 0;
  }
  switch (sixteenth % 8) {
    case 2:
      return 0.55;
    case 3:
      return 0.4;
    default:
      return 0;
  }
}

export function musicCutoff(choke: boolean, life: number): number {
  return choke
    ? CHOKED_HZ * (CHOKE_TOP_HZ / CHOKED_HZ) ** (Math.max(0, life) / CHOKE.below)
    : OPEN_HZ;
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

export function dropTickOf(
  progress: SetProgress,
  breakBars: number,
  tempo: Tempo = MAIN_TEMPO,
): number | null {
  return progress.segment === 'break'
    ? progress.segmentStartTick + breakBars * tempo.ticksPerBar
    : null;
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
    ? PAD_HZ + (track.padOpens ?? 0) * (bar - barOfTick(progress.segmentStartTick, tempo))
    : PAD_HZ;
}
