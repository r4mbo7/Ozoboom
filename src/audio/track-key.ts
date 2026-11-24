import { SCALES, type ScaleName } from '../data/scales';
import type { MusicTrack } from '../data/types';
import { keysOf } from '../shared/records';
import { parsePitchClass, sharpName, semitonesToRoot } from './pitch';
import type { SoundFiles } from './sound-file';

type Keys = SoundFiles['keys'];

// A track in the key its artist set with `pnpm sounds key` (ADR 0026), else as the data writes it. The
// root keeps the register of the data's, the nearest note of its name, and the data's theme scale goes
// with the data's scale.
export function keyedTrack(track: MusicTrack, keys: Keys): MusicTrack {
  const key = keys?.[track.id];
  if (key === undefined) {
    return track;
  }
  const pitchClass = parsePitchClass(key.root);
  if (pitchClass === null) {
    throw new Error(`Unknown root ${key.root} for the track ${track.id}`);
  }
  const keyed: MusicTrack = {
    ...track,
    rootMidi: track.rootMidi + semitonesToRoot(track.rootMidi, pitchClass),
    scale: SCALES[key.scale],
  };
  delete keyed.themeScale;
  return keyed;
}

export function trackKey(
  track: MusicTrack,
  keys: Keys,
): { readonly name: string; readonly byArtist: boolean } {
  const key = keys?.[track.id];
  if (key !== undefined) {
    return { name: `${key.root} ${key.scale}`, byArtist: true };
  }
  const scale = scaleNameOf(track.scale);
  return {
    name: `${sharpName(track.rootMidi)} ${scale ?? track.scale.join(' ')}`,
    byArtist: false,
  };
}

export function scaleNameOf(scale: readonly number[]): ScaleName | undefined {
  return keysOf(SCALES).find((name) => SCALES[name].join(' ') === scale.join(' '));
}
