import { describe, expect, it } from 'vitest';
import { SOIREE_OUVERTURE } from '../data/tracks';
import type { MusicTrack } from '../data/types';
import { drawTrack, stageTracks, trackOf } from './track';

const TRACKS: readonly MusicTrack[] = ['a', 'b', 'c'].map((id) => ({ ...SOIREE_OUVERTURE, id }));
const RANDOMS = [0, 0.2, 0.4, 0.6, 0.8, 0.999];

describe('drawTrack', () => {
  it('never draws the last track played when there are at least two', () => {
    for (const tracks of [TRACKS, TRACKS.slice(0, 2)]) {
      for (const last of tracks) {
        const drawn = RANDOMS.map((random) => drawTrack(tracks, last.id, () => random).id);

        expect(drawn).not.toContain(last.id);
        expect(new Set(drawn).size).toBe(tracks.length - 1);
      }
    }
  });

  it('draws among every track when none was played yet', () => {
    const drawn = RANDOMS.map((random) => drawTrack(TRACKS, '', () => random).id);

    expect(new Set(drawn)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('always plays the only track', () => {
    const only = [SOIREE_OUVERTURE];

    expect(drawTrack(only, SOIREE_OUVERTURE.id, () => 0.5)).toBe(SOIREE_OUVERTURE);
  });
});

describe('trackOf', () => {
  it('plays an unknown track as the first one', () => {
    expect(trackOf(TRACKS, 'b').id).toBe('b');
    expect(trackOf(TRACKS, 'from-a-newer-version').id).toBe('a');
  });
});

describe('stageTracks', () => {
  it('keeps only the tracks the stage names', () => {
    expect(stageTracks(TRACKS, ['c', 'a']).map((track) => track.id)).toEqual(['a', 'c']);
  });

  it('keeps every track for a stage that names none, or none that exist', () => {
    expect(stageTracks(TRACKS, undefined)).toEqual(TRACKS);
    expect(stageTracks(TRACKS, ['nope'])).toEqual(TRACKS);
  });
});
