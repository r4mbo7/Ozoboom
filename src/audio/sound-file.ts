import type { ScaleName } from '../data/scales';

// What `pnpm sounds` measured of a file placed on a slot; the game derives its gain from them.
interface MeasuredFile {
  // Under the game's base URL, in the order a browser tries them: Opus in WebM, then AAC.
  readonly files: readonly string[];
  // Linear, 1 is full scale, rounded up to 1e-5: a gain capped from it never lets the file overshoot.
  readonly peak: number;
}

export interface SampleFile extends MeasuredFile {
  // Its loudest 400 ms, K-weighted, in LUFS, as the gauge of src/audio/dev-specials.ts measures a
  // sound: a file shorter than the window is still divided by it.
  readonly lufs: number;
  readonly seconds: number;
  // Scientific pitch, `A3`; absent, the file plays as it is.
  readonly note?: string;
}

// A loop, an opening or a stem.
export interface LoopFile extends MeasuredFile {
  // Integrated loudness of the whole file, gated as BS.1770 gates it, in LUFS.
  readonly lufs: number;
  readonly bars: number;
}

// The key an artist plays a track in, set with `pnpm sounds key` (ADR 0026): a note without its
// octave, `E` or `Bb`, and a scale of the list.
export interface TrackKey {
  readonly root: string;
  readonly scale: ScaleName;
}

// A point of a danger curve: a filter's cutoff at a share of the stage's volume, in percent.
export interface DangerPoint {
  readonly percent: number;
  readonly hz: number;
}

// A filter of the danger curve, closing from `from` to `to` as the stage's volume falls.
export interface DangerFilter {
  readonly from: DangerPoint;
  readonly to: DangerPoint;
}

// How a track's music thins as its stage nears silence, set with `pnpm sounds danger` (ADR 0029):
// a high-pass that takes its bass, then a low-pass that closes it; the heartbeat goes around both.
export interface DangerCurve {
  readonly highPass: DangerFilter;
  readonly lowPass: DangerFilter;
}

// By slot id: a sample slot holds its files, one per note, a music slot one; by track id, the keys
// and the danger curves the artists set. All absent in the demo.
export interface SoundFiles {
  readonly samples?: Readonly<Record<string, readonly SampleFile[]>>;
  readonly music?: Readonly<Record<string, LoopFile>>;
  // The hit slots the artist silenced (ADR 0027): they play nothing.
  readonly silent?: readonly string[];
  readonly keys?: Readonly<Record<string, TrackKey>>;
  readonly dangers?: Readonly<Record<string, DangerCurve>>;
}
