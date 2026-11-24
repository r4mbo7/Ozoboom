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

// By slot id: a sample slot holds its files, one per note, a music slot one; by track id, the keys the
// artists set. All absent in the demo.
export interface SoundFiles {
  readonly samples?: Readonly<Record<string, readonly SampleFile[]>>;
  readonly music?: Readonly<Record<string, LoopFile>>;
  // The hit slots the artist silenced (ADR 0027): they play nothing.
  readonly silent?: readonly string[];
  readonly keys?: Readonly<Record<string, TrackKey>>;
}
